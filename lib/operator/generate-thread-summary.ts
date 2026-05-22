import type { ChatMessageRow } from "@/lib/chat/map-rows";
import type { StructuredFacts } from "@/lib/ai/structured-memory";
import type { UserChatPersonaRow } from "@/lib/ai/user-cross-chat-profile";
import { grokResponsesComplete, type GrokInputMessage } from "@/lib/xai/grok-responses";
import type { OperatorSummaryContext } from "@/lib/operator/load-summary-context";

const MAX_MESSAGES_IN_PROMPT = 100;

function formatMessages(rows: ChatMessageRow[], peerName: string): string {
  const tail = rows.slice(-MAX_MESSAGES_IN_PROMPT);
  if (!tail.length) return "(nog geen berichten)";
  return tail
    .map((m) => {
      const who = m.sender === "me" ? "USER" : peerName.toUpperCase();
      const body =
        m.body?.trim() ||
        (m.kind === "image" ? "[afbeelding]" : m.kind === "gift" ? "[gift]" : "—");
      return `${who}: ${body}`;
    })
    .join("\n");
}

function formatStructuredFacts(facts: StructuredFacts | null): string {
  if (!facts) return "(geen gestructureerd geheugen)";
  const sections: string[] = [];
  const add = (label: string, arr?: string[]) => {
    if (arr?.length) sections.push(`${label}: ${arr.join("; ")}`);
  };
  add("Over haar/zijn (user)", facts.facts_about_her);
  add("Samen / wij", facts.facts_about_us);
  add("Open loops", facts.open_loops);
  add("Inside jokes", facts.inside_jokes);
  add("Callbacks", facts.callback_hooks);
  return sections.length ? sections.join("\n") : "(leeg)";
}

function formatUserPersona(p: UserChatPersonaRow | null): string {
  if (!p) return "(nog geen cross-chat profiel)";
  return [
    p.summary,
    p.traits.length ? `Traits: ${p.traits.join(", ")}` : "",
    p.topics.length ? `Topics: ${p.topics.join(", ")}` : "",
    `Flirt: ${p.flirt_level}, tempo: ${p.communication_pace}`,
    p.wants.length ? `Wil: ${p.wants.join(", ")}` : "",
    p.avoids.length ? `Vermijdt: ${p.avoids.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateOperatorThreadSummary(
  ctx: OperatorSummaryContext,
): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  const profileBlock = [
    ctx.ownerDisplayName,
    ctx.ownerEmail ? `Email: ${ctx.ownerEmail}` : "",
    ctx.ownerAge ? `Leeftijd: ${ctx.ownerAge}` : "",
    ctx.ownerLocation ? `Plaats: ${ctx.ownerLocation}` : "",
    ctx.ownerBio ? `Bio: ${ctx.ownerBio}` : "",
    ctx.ownerLookingFor ? `Zoekt: ${ctx.ownerLookingFor}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system: GrokInputMessage = {
    role: "system",
    content:
      "Je schrijft een korte OPERATOR-samenvatting voor een menselijke chat-operator die namens een dating-persona antwoordt. " +
      "De operator moet in 30 seconden snappen wie de user is en waar het gesprek staat. " +
      "Schrijf in het Nederlands. Gebruik exact deze koppen (markdown ##):\n\n" +
      "## Over deze gebruiker\n" +
      "## Wat hij/zij over zichzelf zei\n" +
      "## Waar het gesprek over gaat\n" +
      "## Open punten / niet vergeten\n" +
      "## Tips voor jouw volgende antwoord\n\n" +
      "Wees concreet (namen, plannen, voorkeuren). Geen bullshit, geen moraliseren. Max ~400 woorden totaal.",
  };

  const user: GrokInputMessage = {
    role: "user",
    content:
      `Persona waarvoor de operator antwoordt: ${ctx.peerDisplayName}\n\n` +
      `Profiel user (app):\n${profileBlock}\n\n` +
      `Cross-chat user-profiel (alle gesprekken):\n${formatUserPersona(ctx.userChatPersona)}\n\n` +
      `Bestaande thread-geheugen (AI, kan verouderd zijn):\n${ctx.threadMemorySummary ?? "(geen)"}\n\n` +
      `Gestructureerde feiten (AI):\n${formatStructuredFacts(ctx.structuredFacts)}\n\n` +
      `Recente berichten (USER = echte gebruiker, ${ctx.peerDisplayName.toUpperCase()} = persona/operator):\n` +
      formatMessages(ctx.messages, ctx.peerDisplayName),
  };

  const out = await grokResponsesComplete([system, user], {
    temperature: 0.35,
    maxOutputTokens: 900,
  });

  if (!out.ok) {
    return { ok: false, error: out.error };
  }

  const summary = out.text.trim();
  if (!summary) {
    return { ok: false, error: "Lege samenvatting van model" };
  }

  return { ok: true, summary };
}
