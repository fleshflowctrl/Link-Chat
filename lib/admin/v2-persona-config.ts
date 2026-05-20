import type { AppVariant } from "@/lib/app-variant";

/** v2 discover photo pipeline mode (bulk batch + manual regen). */
export type V2PhotoMode = "nude" | "sexy-clothed";

export function parseV2PhotoMode(raw: unknown): V2PhotoMode {
  if (raw === "sexy-clothed") return "sexy-clothed";
  return "nude";
}

/** Default operator brief for bulk v2 persona generation (FetLife / kink audience). */
export const V2_PERSONA_BULK_BRIEF = `Nederlandse vrouwen (22–42) voor een FetLife-achtige dating-app (v2).
Publiek: volwassenen die open staan voor kink, BDSM, poly, casual play en echte chemie — geen "vanilla Tinder" vibe.

Per persona:
- Bio (1e persoon): direct, zelfbewust, licht flirterig; noem 1–2 concrete voorkeuren (bv. rope, latex, dominant/sub/switch, voyeur, exhibition, club nights, aftercare).
- looking_for: kort en expliciet (play partner, FWB, dynamiek, events, nieuwsgierig verkennen).
- backstory + persona_meta: geloofwaardig NL-verhaal; kink mag genoemd worden maar niet pornografisch of grafisch.
- chat_style: speels, open, korte zinnen, weinig formeel; past bij iemand die op een fetish-community-app chat.
- interests: 3–5 chips die passen (events, latex, rope, nightlife, body positivity, etc.) met passende icons.
- funnel_intent_ids: kies uit casual, meaningful, friends, chatting, notsure — map semantiek: casual=play, meaningful=dynamiek, friends=munches/community.
- vibe_tags: 3–6 uit caring, romantic, playful, witty, chill, coffee, travel, movies, gym — kies wat bij haar persoonlijkheid past.
- filter_tags: links, active, online (minstens 2).
- photo_style: fotogeniek, volwassen, expliciet naakt — amateur self-taken (geen studio/boudoir).
  - style: bv. "completely nude amateur mirror selfie", "nude in bed dim light", "shower nude wet skin", "nude kneeling on bed".
  - vibe: intiem, rauw, imperfect belicht; geen glamour-shoot.
  - attractiveness: striking (mooi, sexy, maar nog herkenbaar als echt persoon).
- Geen clichés ("ik hou van reizen en wijn"), geen minderjarigen, geen expliciete porn-taal in bio.`;

/** v2 bulk brief when photos stay clothed but very sexy (lingerie / sheer / micro-bikini). */
export const V2_PERSONA_BULK_BRIEF_SEXY_CLOTHED = `Nederlandse vrouwen (22–42) voor een FetLife-achtige dating-app (v2).
Publiek: volwassenen die open staan voor kink, BDSM, poly, casual play en echte chemie — geen "vanilla Tinder" vibe.

Per persona:
- Bio (1e persoon): direct, zelfbewust, licht flirterig; noem 1–2 concrete voorkeuren (bv. rope, latex, dominant/sub/switch, voyeur, exhibition, club nights, aftercare).
- looking_for: kort en expliciet (play partner, FWB, dynamiek, events, nieuwsgierig verkennen).
- backstory + persona_meta: geloofwaardig NL-verhaal; kink mag genoemd worden maar niet pornografisch of grafisch.
- chat_style: speels, open, korte zinnen, weinig formeel; past bij iemand die op een fetish-community-app chat.
- interests: 3–5 chips die passen (events, latex, rope, nightlife, body positivity, etc.) met passende icons.
- funnel_intent_ids: kies uit casual, meaningful, friends, chatting, notsure.
- vibe_tags: 3–6 uit caring, romantic, playful, witty, chill, coffee, travel, movies, gym.
- filter_tags: links, active, online (minstens 2).
- photo_style: fotogeniek, volwassen, **sexy met kleding** — bijna naakt maar net iets aan; amateur self-taken (geen studio/boudoir).
  - style: bv. "black lace lingerie mirror selfie", "sheer mesh top and thong bedroom", "micro bikini kitchen", "latex harness over sports bra", "wet white t-shirt no bra visible underneath but covered".
  - vibe: intiem, rauw, imperfect belicht; geen glamour-shoot; geen volledige naaktheid in photo_style.style.
  - attractiveness: striking.
- Geen clichés, geen minderjarigen, geen expliciete porn-taal in bio.`;

/** Extra system instructions appended to Grok when generating v2 personas. */
export const V2_PERSONA_SYSTEM_APPEND = `

VARIANT v2 (FetLife / kink community — HARDE REGELS):
- Dit is GEEN standaard dating-app. Persona's moeten passen bij een volwassen fetish/kink publiek.
- Bio en backstory: openhartig over grenzen, nieuwsgierigheid, rollen (dom/sub/switch/curious), events, play — in het Nederlands, niet kinderachtig.
- looking_for: expliciet maar niet vulgair (max 60 tekens).
- photo_style.style: beschrijf expliciet naakte amateur-foto's (completely nude, mirror selfie, bedroom, shower). Geen lingerie-only — v2 gebruikt de nude template-pool voor avatar én galerij.
- photo_style.vibe: rauw, intiem, imperfect belicht; amateur self-taken, geen studio glamour.
- chat_style: flirterig maar menselijk; voice_style bv. "kort, direct, speels" of "warm maar met bite".
- funnel_intent_ids + vibe_tags: ALLEEN ids uit de bestaande schema-lijsten — kies de semantisch beste match voor een kinkster.
- personality_traits: bv. zelfverzekerd, nieuwsgierig, speels, dominant, submissief, open-minded (NL adjectieven).
- Vermijd "student marketing stage" clichés; varieer beroep (horeca, zorg, creatief, ondernemer, events, retail, IT, etc.).
`;

export const V2_PERSONA_SYSTEM_APPEND_SEXY_CLOTHED = `

VARIANT v2 — SEXY MET KLEDING (bijna naakt, HARDE REGELS):
- Zelfde FetLife/kink publiek als v2 nude, maar foto's: lingerie, bikini, sheer, mesh, latex top, harness — **niet volledig naakt**.
- photo_style.style: beschrijf expliciet sexy outfit (lingerie set, micro bikini, fishnet bodysuit, sheer robe, sports bra + thong). Borsten en schaamstreek bedekt door stof — geen "completely nude", geen "bare breasts", geen "vagina visible".
- photo_style.vibe: rauw, intiem, amateur self-taken mirror/bedroom/bathroom; geen studio glamour.
- Bio/backstory/chat_style: zelfde open kink-toon als andere v2-persona's.
- funnel_intent_ids + vibe_tags: ALLEEN ids uit de bestaande schema-lijsten.
`;

export function isV2PersonaVariant(variant: AppVariant | undefined): boolean {
  return variant === "v2";
}

export function defaultAttractivenessForVariant(
  variant: AppVariant | undefined,
): "striking" | "average" | "plain" {
  return isV2PersonaVariant(variant) ? "striking" : "average";
}

export function defaultBulkBriefForVariant(
  variant: AppVariant | undefined,
  photoMode: V2PhotoMode = "nude",
): string {
  if (!isV2PersonaVariant(variant)) return "";
  return photoMode === "sexy-clothed"
    ? V2_PERSONA_BULK_BRIEF_SEXY_CLOTHED
    : V2_PERSONA_BULK_BRIEF;
}

export function v2SystemAppendForPhotoMode(mode: V2PhotoMode): string {
  return mode === "sexy-clothed"
    ? V2_PERSONA_SYSTEM_APPEND_SEXY_CLOTHED
    : V2_PERSONA_SYSTEM_APPEND;
}

/** Rotate sexy outfit descriptors across batch gallery/avatar shots. */
export const V2_SEXY_CLOTHED_OUTFIT_CYCLE = [
  "wearing black lace lingerie bra and panties, very revealing but clothed, breasts and crotch covered by fabric, amateur mirror selfie",
  "micro bikini top and thong, almost nude, nipples and genitals not visible, casual bedroom phone photo",
  "sheer mesh bodysuit over skin, see-through but still wearing clothes, dim bedroom light, amateur self-taken",
  "sports bra and tiny thong, athletic sexy look, stomach and legs visible, breasts covered, mirror selfie",
  "red satin lingerie set, straps and lace, not topless, not bottomless, intimate amateur snapshot",
] as const;

export function v2SexyClothedOutfitForVariant(variant: number): string {
  const idx =
    Math.abs(Math.floor(variant)) % V2_SEXY_CLOTHED_OUTFIT_CYCLE.length;
  return V2_SEXY_CLOTHED_OUTFIT_CYCLE[idx]!;
}

/** Rotate camera families across v2 batch gallery/avatar shots. */
export const V2_NUDE_DIVERSITY_CYCLE = [
  "mirror",
  "low",
  "high",
  "close",
  "side",
] as const;

export type V2NudeDiversity = (typeof V2_NUDE_DIVERSITY_CYCLE)[number];

export function v2NudeDiversityForVariant(variant: number): V2NudeDiversity {
  const idx = Math.abs(Math.floor(variant)) % V2_NUDE_DIVERSITY_CYCLE.length;
  return V2_NUDE_DIVERSITY_CYCLE[idx]!;
}
