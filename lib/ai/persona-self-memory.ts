/**
 * Persona self-memory.
 *
 * Structured-memory tracks facts about the USER and shared context. This
 * module tracks facts about the PERSONA herself — what she has CLAIMED in
 * this thread (work, hobbies, food preferences, plans, where she is right
 * now). It exists separately because:
 *
 *  - Self-contradiction is the most jarring AI tell. If she said "I'm a
 *    nurse" in turn 4 and "I'm a graphic designer" in turn 14, the user
 *    notices instantly.
 *  - The system prompt's bio is static; what she IMPROVISES in chat
 *    drifts. We need a running record of those improvisations.
 *
 * The memory is stored in chat_ai_thread_memory.persona_self_facts (jsonb)
 * — a small array of short Dutch lines like "ik heb een kat", "ik zat
 * gisteravond op de bank pizza te eten". The extractor takes the persona's
 * messages since the last refresh and asks Grok to pull out only
 * self-claims (no callbacks about the user, no callbacks about shared
 * context — those go to structured memory).
 */

import type { ChatMessageRow } from "@/lib/chat/map-rows";
import type { GrokInputMessage } from "@/lib/xai/grok-responses";
import { grokResponsesComplete } from "@/lib/xai/grok-responses";

export type PersonaSelfFacts = {
  /** Things the persona has CLAIMED about herself in this thread. */
  self_claims?: string[];
};

export type PersonaSelfMemoryRow = {
  facts: PersonaSelfFacts;
  prefix_messages_count: number;
};

/** Refresh every ~10 new persona messages — slightly tighter than
 * structured-memory because contradictions hurt fast. */
const REFRESH_DELTA = 10;
const LIST_CAP_SELF_CLAIMS = 18;

function formatPersonaChunk(rows: ChatMessageRow[]): string {
  return rows
    .filter((m) => m.sender === "peer")
    .map((m) => {
      const body = m.kind === "image" ? "[verstuurde een foto]" : (m.body ?? "").trim() || "…";
      return `Persona: ${body}`;
    })
    .join("\n");
}

function dedupCap(arr: string[] | undefined, cap: number): string[] {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const t = String(raw ?? "").trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= cap) break;
  }
  return out;
}

const SYSTEM_PROMPT = `Je bent een memory-extractie module voor een Nederlandse dating-chat.

Je krijgt: (1) eerdere zelf-claims van de persona en (2) een nieuw stuk dialoog waarin alleen de PERSONA aan het woord is.

Je doel: lijst de FEITELIJKE BEWERINGEN op die de persona over ZICHZELF heeft gemaakt — werk, woonplaats, hobby's, eetvoorkeuren, recente activiteiten, plannen, lichamelijke staat ("net gedoucht", "ben moe", "zit op de bank"). 

REGELS:
- Alleen wat de persona feitelijk over zichzelf heeft gezegd. Geen interpretaties.
- Geen vragen, complimenten, of dingen over de gebruiker.
- Geen tijdelijke flirts ("je bent leuk") — dat zijn geen self-claims.
- Schrijf elk item kort (max 60 tekens), in eerste persoon ("ik heb...", "ik woon in...", "ik werk als...").
- Behoud bestaande items die nog steeds gelden, voeg nieuwe toe.
- Als nieuwe info eerdere info tegenspreekt: behoud de meest RECENTE versie.

Output: ÉÉN geldig JSON-object, géén markdown, géén \`\`\` blok. Schema:

{
  "self_claims": ["ik heb een kat genaamd Mila", "ik werk in een coffeeplace", "ik zit nu thuis op de bank", ...]
}

Houd de lijst kort (max ~18 items). Lege array als er niets nieuws is.`;

export async function refreshPersonaSelfMemoryIfNeeded(
  history: ChatMessageRow[],
  prev: PersonaSelfMemoryRow | null,
): Promise<PersonaSelfMemoryRow> {
  const prevFacts: PersonaSelfFacts = prev?.facts ?? {};
  const prevCount = prev?.prefix_messages_count ?? 0;

  // Count NEW persona messages since last refresh.
  const newSlice = history.slice(prevCount);
  const newPersonaCount = newSlice.filter((m) => m.sender === "peer").length;
  if (newPersonaCount < REFRESH_DELTA) {
    return { facts: prevFacts, prefix_messages_count: prevCount };
  }

  const userContent =
    `Eerdere zelf-claims (JSON):\n${JSON.stringify(prevFacts, null, 0)}\n\n` +
    `Nieuw dialoog van de persona alleen:\n${formatPersonaChunk(newSlice)}\n\n` +
    "Geef nu de volledige bijgewerkte zelf-claim-memo als JSON.";

  const input: GrokInputMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  const out = await grokResponsesComplete(input, {
    temperature: 0.2,
    maxOutputTokens: 700,
  });

  if (!out.ok) {
    return { facts: prevFacts, prefix_messages_count: prevCount };
  }

  const text = out.text.trim();
  let parsed: PersonaSelfFacts | null = null;
  try {
    parsed = JSON.parse(text) as PersonaSelfFacts;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]) as PersonaSelfFacts;
      } catch {
        parsed = null;
      }
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return { facts: prevFacts, prefix_messages_count: prevCount };
  }

  // "newer wins" — new claims first, then older.
  const merged: PersonaSelfFacts = {
    self_claims: dedupCap(
      [...(parsed.self_claims ?? []), ...(prevFacts.self_claims ?? [])],
      LIST_CAP_SELF_CLAIMS,
    ),
  };
  return { facts: merged, prefix_messages_count: history.length };
}

export function hasAnySelfClaims(f: PersonaSelfFacts | null | undefined): boolean {
  if (!f) return false;
  return (f.self_claims?.length ?? 0) > 0;
}
