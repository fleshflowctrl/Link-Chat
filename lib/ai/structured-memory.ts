/**
 * Structured memory extractor for AI dating-app chats.
 *
 * The legacy `thread_summary` is a paragraph of prose; useful for vague
 * continuity but bad for sharp callbacks. This module extracts actionable
 * structured items the persona can lean on by name:
 *
 *   - facts_about_her    — concrete things the user said about themselves
 *   - facts_about_us     — shared experiences / common ground
 *   - open_loops         — things one of them said they'd return to
 *   - inside_jokes       — recurring images / phrases between them
 *   - callback_hooks     — small specific details worth re-mentioning
 *
 * The extractor is incremental: it takes the previous structured-facts
 * blob plus the dialogue since the last extraction, and returns an updated
 * blob. We cap each list to keep the prompt tight; older entries fall off
 * naturally as new ones arrive.
 *
 * Cost / latency: one extra Grok call per refresh, comparable to the prose
 * summary refresh (which still runs in parallel — they coexist). We refresh
 * less often than the prose summary by gating on a fixed message-delta
 * threshold (every ~12 new messages).
 */

import type { ChatMessageRow } from "@/lib/chat/map-rows";
import type { GrokInputMessage } from "@/lib/xai/grok-responses";
import { grokResponsesComplete } from "@/lib/xai/grok-responses";

export type StructuredFacts = {
  facts_about_her?: string[];
  facts_about_us?: string[];
  open_loops?: string[];
  inside_jokes?: string[];
  callback_hooks?: string[];
};

export type StructuredMemoryRow = {
  facts: StructuredFacts;
  /** Index in history at which the last refresh ran. */
  prefix_messages_count: number;
};

/** How many new messages must arrive before we re-extract. Picked so casual
 * 5-turn flurries don't trigger a Grok call but a real conversation
 * eventually catches up. */
const REFRESH_DELTA = 12;

/** Cap each list so the prompt stays tight. Excess entries are pruned with
 * a "newer wins" rule — most recent extractions overwrite older ones if
 * they're semantically duplicates (we use a dumb "first occurrence" dedup). */
const LIST_CAP_FACTS_HER = 14;
const LIST_CAP_FACTS_US = 10;
const LIST_CAP_OPEN_LOOPS = 8;
const LIST_CAP_JOKES = 6;
const LIST_CAP_HOOKS = 12;

function formatChunk(rows: ChatMessageRow[]): string {
  return rows
    .map((m) => {
      const who = m.sender === "me" ? "User" : "Persona";
      const body = m.kind === "image" ? "[photo]" : (m.body ?? "").trim() || "…";
      return `${who}: ${body}`;
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

function mergeFacts(
  prev: StructuredFacts,
  next: StructuredFacts,
): StructuredFacts {
  // "newer wins" — take new entries first, then fill remaining cap with old.
  const prepend = (a: string[] | undefined, b: string[] | undefined, cap: number) =>
    dedupCap([...(a ?? []), ...(b ?? [])], cap);
  return {
    facts_about_her: prepend(next.facts_about_her, prev.facts_about_her, LIST_CAP_FACTS_HER),
    facts_about_us: prepend(next.facts_about_us, prev.facts_about_us, LIST_CAP_FACTS_US),
    open_loops: prepend(next.open_loops, prev.open_loops, LIST_CAP_OPEN_LOOPS),
    inside_jokes: prepend(next.inside_jokes, prev.inside_jokes, LIST_CAP_JOKES),
    callback_hooks: prepend(next.callback_hooks, prev.callback_hooks, LIST_CAP_HOOKS),
  };
}

const SYSTEM_PROMPT = `Je bent een memory-extractie module voor een Nederlandse dating-chat.

Je krijgt: (1) eerdere gestructureerde memo's en (2) een nieuw stuk dialoog (User = de gebruiker, Persona = de persona zelf). 

Werk de memo bij met NIEUWE informatie uit dit dialoog-stuk. Niets verzinnen — alleen wat letterlijk in de tekst staat (of duidelijk impliceert). Bewaar bestaande punten die nog steeds kloppen; verwijder of negeer punten die door nieuwe info zijn weersproken.

Output: ÉÉN geldig JSON-object, geen markdown, geen uitleg, geen \`\`\`-blokken. Schema:

{
  "facts_about_her": [...],   // concrete dingen die de gebruiker zelf vertelde (werk, woonplaats, hobby's, voorkeuren). Kort, één zin per item.
  "facts_about_us": [...],    // dingen die jullie samen delen of besproken hebben (gedeelde smaak, een mening waar jullie het over eens waren, een afspraak in de chat).
  "open_loops": [...],        // beloftes of zinnen als "ik vertel je morgen wel over X" — onafgeronde dingen waar later op kan worden teruggekomen. Voorvoegsel "User: " of "Persona: " om aan te geven wie het zei.
  "inside_jokes": [...],      // herhaaldelijk teruggekomen woorden, beelden of grappen die alleen tussen hen iets betekenen.
  "callback_hooks": [...]     // kleine specifieke details (kleur van haar jas, naam van haar hond, een rare gewoonte van hem) die later natuurlijk teruggebracht kunnen worden.
}

Houd elk veld kort (max 6-12 items, max ~80 tekens per item). Schrijf in het Nederlands. Lege arrays als er niets nieuws is.`;

/**
 * Refresh structured memory if enough new messages have arrived since the
 * last extraction. Idempotent — calling repeatedly without new messages is
 * cheap and returns the cached row.
 */
export async function refreshStructuredMemoryIfNeeded(
  history: ChatMessageRow[],
  prev: StructuredMemoryRow | null,
): Promise<StructuredMemoryRow> {
  const prevFacts: StructuredFacts = prev?.facts ?? {};
  const prevCount = prev?.prefix_messages_count ?? 0;
  const newSinceLast = history.length - prevCount;

  // Not enough new material — return as-is.
  if (newSinceLast < REFRESH_DELTA) {
    return { facts: prevFacts, prefix_messages_count: prevCount };
  }

  const chunk = history.slice(prevCount);
  if (chunk.length === 0) {
    return { facts: prevFacts, prefix_messages_count: prevCount };
  }

  const userContent =
    `Eerdere memo (JSON):\n${JSON.stringify(prevFacts, null, 0)}\n\n` +
    `Nieuw dialoog (chronologisch):\n${formatChunk(chunk)}\n\n` +
    "Geef nu de volledige bijgewerkte memo als JSON.";

  const input: GrokInputMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  const out = await grokResponsesComplete(input, {
    temperature: 0.2,
    maxOutputTokens: 1200,
  });

  if (!out.ok) {
    return { facts: prevFacts, prefix_messages_count: prevCount };
  }

  // Robust JSON extraction — Grok occasionally wraps the JSON in noise.
  const text = out.text.trim();
  let parsed: StructuredFacts | null = null;
  try {
    parsed = JSON.parse(text) as StructuredFacts;
  } catch {
    // Try to recover by extracting the first {...} block.
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]) as StructuredFacts;
      } catch {
        parsed = null;
      }
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return { facts: prevFacts, prefix_messages_count: prevCount };
  }

  const next = mergeFacts(prevFacts, parsed);
  return { facts: next, prefix_messages_count: history.length };
}

/** Convenience: are there any actionable entries to surface in the prompt? */
export function hasAnyFacts(f: StructuredFacts | null | undefined): boolean {
  if (!f) return false;
  return Boolean(
    (f.facts_about_her?.length ?? 0) +
      (f.facts_about_us?.length ?? 0) +
      (f.open_loops?.length ?? 0) +
      (f.inside_jokes?.length ?? 0) +
      (f.callback_hooks?.length ?? 0),
  );
}
