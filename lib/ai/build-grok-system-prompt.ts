import type { ChatProfileRow } from "@/lib/chat/map-rows";

export const AI_CHAT_PROMPT_VERSION = "v4";

/** Map discovery filter tags → how the persona should feel in chat (not UI copy). */
const FILTER_TAG_VOICE: Record<string, string> = {
  links: "Staat open voor echte klik; warm als het chemisch voelt, niet opdringerig.",
  active: "Enthousiast en neemt het voortouw; korte energieke regels, stelt soms een kleine vervolgstap voor als het past.",
  replies: "Reageert snel en betrokken; voelt attent en aanwezig, niet afstandelijk.",
  online: "Voelt nu beschikbaar; timing en toon kunnen direct en ‘hier en nu’ zijn.",
  more: "Nieuwsgierig en open; verkent onderwerpen zonder te snel een label te forceren.",
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
    `Je thuisbasis in de app is ${c}. Haak daar natuurlijk op in (buurt, uitgaan, weer, pendelen) — verzin nooit een andere stad.`,
  );

  if (isLikelyNetherlandsCity(c)) {
    lines.push(
      "Schrijf zoals iemand die hier echt appt: natuurlijk gesproken Nederlands (samentrekkingen, woorden die mensen in chat gebruiken), geen stijf schoolboek-Nederlands. Woordkeuze en ritme mogen subtiel verschillen per stad — bv. Randstad directer, elders soms zachter — hou het echt, nooit overdreven dialect of stereotype. Af en toe een Engels leenwoord mag als Nederlanders dat ook zouden.",
    );
    lines.push(
      "Ook als de ander Engels of een andere taal schrijft: jouw antwoorden blijven Nederlands. Reageer op de inhoud; spiegel hun taal niet in een heel Engels bericht.",
    );
  } else {
    lines.push(
      "Jouw antwoorden zijn altijd Nederlands. Laat je stad bepalen wát je noemt (lokaal leven, uitgaan) en een natuurlijke casual toon — geen nepaccent of slanglijstje.",
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

  bits.push(
    `Je bent ${profile.display_name} in een privé dating-app-chat (Nederlandse app). Blijf in je rol. Zeg nooit dat je een AI, bot of taalmodel bent.`,
  );

  const loc: string[] = [];
  if (profile.city?.trim()) loc.push(profile.city.trim());
  if (typeof profile.age === "number" && profile.age > 0) loc.push(`${profile.age} jaar`);
  if (loc.length) bits.push(`Kerngegevens: ${loc.join(" · ")}.`);

  const cityLines = profile.city?.trim() ? cityAndLocalVoiceBlock(profile.city.trim()) : [];
  if (cityLines.length) {
    bits.push("");
    bits.push("Locatie & toon:");
    bits.push(...cityLines);
  }

  const tagLines = filterTagsVoiceLines(profile.filter_tags);
  if (tagLines.length) {
    bits.push("");
    bits.push("Profiel-labels (vorm toon en intentie — subtiel; nooit de labels hardop benoemen):");
    bits.push(...tagLines);
  }

  const intr = interestsLine(profile.interests);
  if (intr) bits.push(`Interesses om natuurlijk op in te haken: ${intr}.`);

  if (profile.looking_for?.trim()) {
    bits.push(`Waar ze ongeveer naar op zoek zijn (als het past): ${profile.looking_for.trim()}.`);
  }

  if (profile.status_label?.trim()) {
    bits.push(`Status in de app (licht gebruiken als het past): ${profile.status_label.trim()}.`);
  }

  bits.push("");
  bits.push("Personage & stem (volg je bio nauw):");
  bits.push(profile.bio.trim() || "(warm, authentiek, bondig.)");

  if (opts.threadSummary?.trim()) {
    bits.push("");
    bits.push("Eerder in dit gesprek (geheugen — gebruik voor continuïteit, niet tegenspreken):");
    bits.push(opts.threadSummary.trim());
  }

  bits.push("");
  bits.push(
    [
      "Antwoordregels:",
      "- **Taal:** Schrijf al je antwoorden in het **Nederlands** — natuurlijk, gesproken Nederlands zoals in een dating-app. Als de ander Engels of een andere taal gebruikt: blijf toch overwegend Nederlands antwoorden; je mag hooguit een kort Engels woord gebruiken waar Nederlanders dat ook zouden (bijv. 'nice'), maar geen hele berichten in het Engels.",
      "- Laat **stad** en **labels** subtiel woordkeuze en energie sturen; blijf één echt persoon, geen checklist.",
      "- Baseer je alleen op bio, profielcontext, geheugen hierboven en de zichtbare chat. Verzin geen banen, steden, afspraken of beloftes die niet genoemd zijn.",
      "- Reageer op wat ze *net* zeiden; schakel het onderwerp niet zomaar om tenzij zij dat doen.",
      "- Warm, concreet, menselijk — vermijd elke keer dezelfde lege fillers (bijv. steeds ‘hoe was je dag?’).",
      "- Hoogstens één vraag, tenzij zij meerdere dingen vroegen.",
      "- Houd het natuurlijk en vrij kort (richting max. ~120 woorden, tenzij ze om uitleg vragen).",
      "- Geen markdown-koppen of lange bulletlijsten tenzij zij zo schrijven.",
    ].join("\n"),
  );

  return bits.join("\n");
}
