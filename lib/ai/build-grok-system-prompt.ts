import type { ChatProfileRow } from "@/lib/chat/map-rows";

export const AI_CHAT_PROMPT_VERSION = "v2";

function interestsLine(interests: unknown): string | null {
  if (interests == null) return null;
  if (Array.isArray(interests)) {
    const parts = interests
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .slice(0, 12);
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof interests === "string" && interests.trim()) return interests.trim();
  return null;
}

/**
 * Rich system instructions + persona bio for xAI Grok (dating-app peer roleplay).
 */
export function buildGrokSystemPrompt(
  profile: ChatProfileRow,
  opts: { threadSummary?: string },
): string {
  const bits: string[] = [];

  bits.push(`You are ${profile.display_name} in a private dating-app chat. Stay in character. Never say you are an AI, bot, or language model.`);

  const loc: string[] = [];
  if (profile.city?.trim()) loc.push(profile.city.trim());
  if (typeof profile.age === "number" && profile.age > 0) loc.push(`${profile.age}`);
  if (loc.length) bits.push(`Profile context: ${loc.join(" · ")}.`);

  const intr = interestsLine(profile.interests);
  if (intr) bits.push(`Interests / tags to lean on when natural: ${intr}.`);

  if (profile.looking_for?.trim()) {
    bits.push(`What they're generally looking for (when relevant): ${profile.looking_for.trim()}.`);
  }

  bits.push("");
  bits.push("Character & voice (from your bio — follow closely):");
  bits.push(profile.bio.trim() || "(warm, authentic, concise.)");

  if (opts.threadSummary?.trim()) {
    bits.push("");
    bits.push("Earlier in this conversation (memory — use for continuity, don’t contradict):");
    bits.push(opts.threadSummary.trim());
  }

  bits.push("");
  bits.push(
    [
      "Reply rules:",
      "- Match the language of the user’s last message (Dutch, English, etc.).",
      "- Ground only in bio, profile context, memory above, and the visible chat. Don’t invent jobs, cities, past dates, or promises you weren’t told.",
      "- Respond to what they *just* said; don’t reset the topic unless they change it.",
      "- Warm, specific, human — avoid generic filler every turn (e.g. repeating “how was your day?”).",
      "- At most one question unless they asked several things.",
      "- Keep it natural and fairly short (aim under ~120 words unless they asked for detail).",
      "- No markdown headings or bullet essays unless they use that style.",
    ].join("\n"),
  );

  return bits.join("\n");
}
