import type { ChatProfileRow } from "@/lib/chat/map-rows";

export const AI_CHAT_PROMPT_VERSION = "v3";

/** Map discovery filter tags → how the persona should feel in chat (not UI copy). */
const FILTER_TAG_VOICE: Record<string, string> = {
  links: "Open to a real match or connection; warm when there’s chemistry, not pushy.",
  active: "Upbeat and takes initiative; short energetic lines, suggests small next steps when it fits.",
  replies: "Quick to engage; answers feel attentive and present, not distant.",
  online: "Feels available in the moment; timing and tone can feel immediate and here.",
  more: "Curious and open-ended; happy to explore topics without rushing a label.",
};

function filterTagsVoiceLines(tags: string[] | null | undefined): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const id = String(raw).toLowerCase().trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const hint = FILTER_TAG_VOICE[id];
    if (hint) out.push(`- (${id}) ${hint}`);
  }
  return out;
}

/** Rough NL urban areas — nudge natural spoken Dutch / local texture without caricature. */
function isLikelyNetherlandsCity(city: string): boolean {
  const c = city.toLowerCase();
  const nl = [
    "amsterdam",
    "rotterdam",
    "utrecht",
    "den haag",
    "s-gravenhage",
    "haarlem",
    "eindhoven",
    "tilburg",
    "groningen",
    "almere",
    "breda",
    "nijmegen",
    "enschede",
    "haarlemmermeer",
    "amstelveen",
    "hilversum",
    "arnhem",
    "zaanstad",
    "apeldoorn",
    "leiden",
    "maastricht",
    "zwolle",
  ];
  return nl.some((n) => c.includes(n));
}

function cityAndLocalVoiceBlock(city: string): string[] {
  const c = city.trim();
  if (!c) return [];

  const lines: string[] = [];
  lines.push(
    `Your home base in the app is ${c}. Ground small details there when natural (neighborhood vibe, going out, weather, commute) — never invent a different city.`,
  );

  if (isLikelyNetherlandsCity(c)) {
    lines.push(
      "When you write Dutch, sound like someone who actually texts from this area: natural spoken Dutch (contractions, fillers people use in chat), not formal textbook Dutch. Word choice and rhythm can differ by city — e.g. Randstad directness vs softer phrasing elsewhere — keep it subtle and real, never exaggerated dialect or stereotype. Mixing a rare English loanword in Dutch is fine if locals would.",
    );
    lines.push(
      "If the user writes English, still match their language; you can keep being from your city in content (places, local life) without forcing Dutch words unless they switch.",
    );
  } else {
    lines.push(
      "Match the user’s language. Let your city shape **what** you mention (local life) and a **natural** casual tone for that place — not a fake accent or slang list.",
    );
  }

  return lines;
}

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
  if (typeof profile.age === "number" && profile.age > 0) loc.push(`${profile.age} years old`);
  if (loc.length) bits.push(`Quick facts: ${loc.join(" · ")}.`);

  const cityLines = profile.city?.trim() ? cityAndLocalVoiceBlock(profile.city.trim()) : [];
  if (cityLines.length) {
    bits.push("");
    bits.push("Location & how you sound:");
    bits.push(...cityLines);
  }

  const tagLines = filterTagsVoiceLines(profile.filter_tags);
  if (tagLines.length) {
    bits.push("");
    bits.push("Profile labels (shape tone and intent — stay subtle, don’t name the labels out loud):");
    bits.push(...tagLines);
  }

  const intr = interestsLine(profile.interests);
  if (intr) bits.push(`Interests to lean on when natural: ${intr}.`);

  if (profile.looking_for?.trim()) {
    bits.push(`What they're generally looking for (when relevant): ${profile.looking_for.trim()}.`);
  }

  if (profile.status_label?.trim()) {
    bits.push(`Status vibe on the app (use lightly if it fits): ${profile.status_label.trim()}.`);
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
      "- Let **city** and **labels** gently shape word choice and energy; still sound like one real person, not a checklist.",
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
