import type { AppVariant } from "@/lib/app-variant";

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
- photo_style: ALTIJD fotogeniek en suggestief gekleed — GEEN volledige naaktheid in style/appearance tekst.
  - style: bv. zwarte lingerie, latex set, leather harness over outfit, clubwear, silk slip, bodystocking onder jasje.
  - vibe: zelfverzekerd, sensueel, "late night bedroom mirror selfie" of "dim red mood lighting".
  - attractiveness: striking (mooi, sexy, maar nog herkenbaar als echt persoon).
- Geen clichés ("ik hou van reizen en wijn"), geen minderjarigen, geen expliciete porn-taal in bio.`;

/** Extra system instructions appended to Grok when generating v2 personas. */
export const V2_PERSONA_SYSTEM_APPEND = `

VARIANT v2 (FetLife / kink community — HARDE REGELS):
- Dit is GEEN standaard dating-app. Persona's moeten passen bij een volwassen fetish/kink publiek.
- Bio en backstory: openhartig over grenzen, nieuwsgierigheid, rollen (dom/sub/switch/curious), events, play — in het Nederlands, niet kinderachtig.
- looking_for: expliciet maar niet vulgair (max 60 tekens).
- photo_style.style MOET suggestieve kleding beschrijven (lingerie, latex, leather, club outfit, silk slip). NOOIT "fully nude" of "topless" in appearance/style — gallery kan later apart.
- photo_style.vibe: sensueel, zelfverzekerd, intieme sfeer (dim light, bedroom, mirror selfie aesthetic).
- chat_style: flirterig maar menselijk; voice_style bv. "kort, direct, speels" of "warm maar met bite".
- funnel_intent_ids + vibe_tags: ALLEEN ids uit de bestaande schema-lijsten — kies de semantisch beste match voor een kinkster.
- personality_traits: bv. zelfverzekerd, nieuwsgierig, speels, dominant, submissief, open-minded (NL adjectieven).
- Vermijd "student marketing stage" clichés; varieer beroep (horeca, zorg, creatief, ondernemer, events, retail, IT, etc.).
`;

export function isV2PersonaVariant(variant: AppVariant | undefined): boolean {
  return variant === "v2";
}

export function defaultAttractivenessForVariant(
  variant: AppVariant | undefined,
): "striking" | "average" | "plain" {
  return isV2PersonaVariant(variant) ? "striking" : "average";
}

export function defaultBulkBriefForVariant(variant: AppVariant | undefined): string {
  return isV2PersonaVariant(variant) ? V2_PERSONA_BULK_BRIEF : "";
}
