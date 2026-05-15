/**
 * Cross-conversation user profile.
 *
 * Aggregates ALL messages a user has ever sent across every chat thread
 * and asks Grok to summarise who they are: their flirt level, pace,
 * tone, recurring topics, what they want and what they avoid. The
 * resulting profile is injected into the system prompt of every persona
 * the user chats with, so the personas adapt to who this user actually
 * is across all threads.
 *
 * Refresh strategy:
 *   - First call: builds the profile from scratch using up to
 *     MAX_MESSAGES_TO_ANALYZE recent user messages.
 *   - Subsequent calls: re-runs whenever there are
 *     REFRESH_THRESHOLD_NEW_MESSAGES new messages since the last refresh.
 *   - Returns the cached row otherwise.
 *
 * Cost: one Grok call per refresh (~5-15s), gated by the threshold so a
 * casual chat never triggers it back-to-back. The profile is small
 * (~300 tokens) so injecting it in every prompt is cheap.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { grokResponsesComplete, type GrokInputMessage } from "@/lib/xai/grok-responses";

export type UserChatPersonaRow = {
  user_id: string;
  summary: string;
  traits: string[];
  topics: string[];
  flirt_level: "low" | "medium" | "high" | "explicit";
  communication_pace: "slow" | "normal" | "rapid";
  message_length: "short" | "medium" | "long";
  wants: string[];
  avoids: string[];
  messages_analyzed: number;
  updated_at: string;
};

const FLIRT_LEVELS = ["low", "medium", "high", "explicit"] as const;
const PACES = ["slow", "normal", "rapid"] as const;
const LENGTHS = ["short", "medium", "long"] as const;

/** Re-run when this many new user messages have arrived since the last refresh. */
const REFRESH_THRESHOLD_NEW_MESSAGES = 8;

/** Hard cap on messages we feed Grok. Very chatty users don't need 5000
 * messages summarised — the trailing window captures their current
 * vibe just as well, and keeps the Grok call cheap. */
const MAX_MESSAGES_TO_ANALYZE = 200;

const SYSTEM_PROMPT = `Je bent een gedrags-analyse module voor een Nederlandse dating-chat-app.

Je krijgt een lijst van berichten die ÉÉN gebruiker (steeds dezelfde man) heeft gestuurd in verschillende chats met verschillende vrouwen. Op basis daarvan geef je een psychologisch profiel: wat voor persoon hij is, wat hij wil, en hoe een persona haar aanpak op hem kan afstemmen.

Output: ÉÉN geldig JSON-object, geen markdown, geen uitleg, geen \`\`\`-blokken. Schema (alle velden verplicht):

{
  "summary": "1-3 zinnen Nederlands die in één blik schetsen wat voor type chatter hij is. Concreet, niet generiek.",
  "traits": ["string", ...],            // 3-7 NL adjectieven of korte zinnen die zijn persoonlijkheid kenmerken
  "topics": ["string", ...],            // 3-8 onderwerpen die hij vaak ter sprake brengt
  "flirt_level": "low" | "medium" | "high" | "explicit",
  "communication_pace": "slow" | "normal" | "rapid",
  "message_length": "short" | "medium" | "long",
  "wants": ["string", ...],             // 3-6 dingen die hij duidelijk zoekt of leuk vindt — KORT en concreet
  "avoids": ["string", ...]             // 0-5 dingen die hij afhoudt of niet leuk vindt
}

Calibratie van flirt_level:
- "low" = beleefd, terughoudend, geen seksuele toespelingen
- "medium" = af en toe een complimentje of speelse plagerij, maar overall warm en gewoon
- "high" = duidelijk flirty, complimenten over uiterlijk, suggestieve toespelingen
- "explicit" = vraagt regelmatig om naaktfoto's, gebruikt seksuele taal, dirty talk

Calibratie van communication_pace:
- "slow" = stuurt af en toe, meestal langere pauzes
- "normal" = normale chat-frequentie, gemixt
- "rapid" = stuurt veel en snel, korte burst-berichten

Calibratie van message_length:
- "short" = vooral 1-paar-woorden of één zin
- "medium" = 1-3 zinnen meestal
- "long" = vaak langere uitleggende berichten

Regels:
- Schrijf summary, traits, topics, wants en avoids in het Nederlands.
- Geen waarde-oordeel, geen "hij is een loser" — neutraal en bruikbaar.
- Als de data te dun is (minder dan 5 berichten): geef je beste gok maar markeer dit in summary met iets als "nog beperkte data".
- Wees concreet. "Houdt van koken" is beter dan "houdt van eten".`;

/** Fetch the cached profile for this user (or null). */
export async function loadUserChatPersona(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserChatPersonaRow | null> {
  const { data, error } = await supabase
    .from("user_chat_persona")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return normaliseRow(data);
}

/** Count user messages so we can decide whether to refresh. */
async function countUserMessages(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", userId)
    .eq("sender", "me");
  if (error) return 0;
  return typeof count === "number" ? count : 0;
}

/** Pull the most recent user messages across all peers (chronological,
 * oldest of the slice first) up to MAX_MESSAGES_TO_ANALYZE. */
async function fetchRecentUserMessages(
  supabase: SupabaseClient,
  userId: string,
  limit = MAX_MESSAGES_TO_ANALYZE,
): Promise<Array<{ body: string; created_at: string }>> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("body, kind, created_at")
    .eq("owner_user_id", userId)
    .eq("sender", "me")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  // Reverse so the LLM gets oldest → newest.
  const rows = (data as Array<{ body: string | null; kind: string; created_at: string }>)
    .reverse()
    .map((r) => ({
      body:
        r.kind === "image"
          ? "[stuurde een foto]"
          : r.kind === "gift"
            ? "[stuurde een credits-cadeau]"
            : (r.body ?? "").trim(),
      created_at: r.created_at,
    }))
    .filter((r) => r.body.length > 0);
  return rows;
}

/** Refresh the profile if enough new messages have arrived. Returns the
 * row that should be used for prompt-building right now (cached or freshly
 * computed). Never throws; on failure returns the cached row (or null). */
export async function refreshUserChatPersonaIfNeeded(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserChatPersonaRow | null> {
  const cached = await loadUserChatPersona(supabase, userId);
  const totalUserMessages = await countUserMessages(supabase, userId);

  const needsFirstBuild = !cached;
  const cachedCount = cached?.messages_analyzed ?? 0;
  const newSinceLastBuild = totalUserMessages - cachedCount;
  const needsRefresh = newSinceLastBuild >= REFRESH_THRESHOLD_NEW_MESSAGES;

  if (!needsFirstBuild && !needsRefresh) {
    return cached;
  }

  // Don't bother building a profile from <3 messages — it's pure noise.
  if (totalUserMessages < 3) {
    return cached;
  }

  const messages = await fetchRecentUserMessages(supabase, userId);
  if (messages.length === 0) {
    return cached;
  }

  const userContent =
    `Berichten van deze gebruiker (chronologisch, ${messages.length} stuks):\n\n` +
    messages.map((m, i) => `${i + 1}. ${m.body}`).join("\n") +
    "\n\nGeef nu het JSON-profiel.";

  const input: GrokInputMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  const out = await grokResponsesComplete(input, {
    temperature: 0.3,
    maxOutputTokens: 800,
  });

  if (!out.ok) {
    return cached;
  }

  const parsed = parseProfile(out.text);
  if (!parsed) return cached;

  const row: Omit<UserChatPersonaRow, "updated_at"> = {
    user_id: userId,
    summary: parsed.summary,
    traits: parsed.traits,
    topics: parsed.topics,
    flirt_level: parsed.flirt_level,
    communication_pace: parsed.communication_pace,
    message_length: parsed.message_length,
    wants: parsed.wants,
    avoids: parsed.avoids,
    messages_analyzed: totalUserMessages,
  };

  const { error: upErr } = await supabase
    .from("user_chat_persona")
    .upsert(
      { ...row, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (upErr) {
    console.warn("[user-cross-chat-profile] upsert failed:", upErr.message);
    return cached;
  }

  return { ...row, updated_at: new Date().toISOString() };
}

function asStringArray(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim().slice(0, 120))
    .slice(0, max);
}

function asEnum<T extends string>(
  v: unknown,
  values: readonly T[],
  fallback: T,
): T {
  if (typeof v === "string" && (values as readonly string[]).includes(v)) {
    return v as T;
  }
  return fallback;
}

function parseProfile(raw: string): {
  summary: string;
  traits: string[];
  topics: string[];
  flirt_level: UserChatPersonaRow["flirt_level"];
  communication_pace: UserChatPersonaRow["communication_pace"];
  message_length: UserChatPersonaRow["message_length"];
  wants: string[];
  avoids: string[];
} | null {
  const text = raw.trim();
  let obj: Record<string, unknown> | null = null;
  try {
    obj = JSON.parse(text) as Record<string, unknown>;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        obj = JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        obj = null;
      }
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const summary = typeof obj.summary === "string" ? obj.summary.trim().slice(0, 600) : "";
  if (!summary) return null;
  return {
    summary,
    traits: asStringArray(obj.traits, 8),
    topics: asStringArray(obj.topics, 10),
    flirt_level: asEnum(obj.flirt_level, FLIRT_LEVELS, "medium"),
    communication_pace: asEnum(obj.communication_pace, PACES, "normal"),
    message_length: asEnum(obj.message_length, LENGTHS, "medium"),
    wants: asStringArray(obj.wants, 8),
    avoids: asStringArray(obj.avoids, 6),
  };
}

function normaliseRow(raw: Record<string, unknown>): UserChatPersonaRow {
  return {
    user_id: String(raw.user_id ?? ""),
    summary: typeof raw.summary === "string" ? raw.summary : "",
    traits: asStringArray(raw.traits, 8),
    topics: asStringArray(raw.topics, 10),
    flirt_level: asEnum(raw.flirt_level, FLIRT_LEVELS, "medium"),
    communication_pace: asEnum(raw.communication_pace, PACES, "normal"),
    message_length: asEnum(raw.message_length, LENGTHS, "medium"),
    wants: asStringArray(raw.wants, 8),
    avoids: asStringArray(raw.avoids, 6),
    messages_analyzed: typeof raw.messages_analyzed === "number" ? raw.messages_analyzed : 0,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : new Date().toISOString(),
  };
}
