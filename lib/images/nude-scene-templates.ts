/**
 * Dedicated pool of explicit nude scene templates.
 *
 * These are designed to produce highly varied, realistic amateur self-taken nude photos.
 * Each template contains the full 7-field structure so the prompt builder
 * can create truly different compositions (angle, pose, lighting, capture style).
 *
 * Goal: 100+ templates so that generating 3 photos per persona almost never repeats.
 */

import type { SceneTemplate } from "./scene-templates";
import { pickDiverseNudeTemplates } from "@/lib/images/pick-diverse-nude-templates";

export const NUDE_TEMPLATES: readonly SceneTemplate[] = [
  // === MIRROR SELFIES - STANDING ===
  {
    scene: "naakte spiegel selfie in slaapkamer 's ochtends",
    camera: "low angle phone selfie, arm visible, full body slightly from below",
    backdrop: "simple bedroom, unmade bed with white sheets, wooden headboard, soft morning light from window",
    lighting: "soft natural morning window light from the side, gentle shadows on skin",
    capture: "real amateur mirror selfie, slight motion blur on hand, iPhone front camera",
    outfit: "completely nude, no clothes at all, bare skin, full frontal nudity",
    pose: "standing relaxed in front of mirror, one hand holding phone, other hand resting on hip, slight smile",
    kind: "gallery",
  },
  {
    scene: "naakte spiegel selfie in badkamer na het douchen",
    camera: "straight-on phone selfie, slightly high angle, wet skin reflections",
    backdrop: "modern bathroom, white tiles, fogged mirror, towel hanging on the side",
    lighting: "bright overhead bathroom light mixed with window light, wet skin highlights",
    capture: "real self-taken bathroom mirror selfie, steam on mirror edges, amateur",
    outfit: "completely nude, water droplets on skin, no clothes",
    pose: "standing in front of mirror, phone in one hand, other hand pushing wet hair back",
    kind: "gallery",
  },
  {
    scene: "naakte spiegel selfie in slaapkamer met ochtendzon",
    camera: "3/4 angle from slightly below, phone held in right hand",
    backdrop: "sunny bedroom, open curtains, wooden floor, plant in corner",
    lighting: "warm golden morning sunlight streaming across the body from the side",
    capture: "real personal mirror selfie, lens flare from sun, natural skin tones",
    outfit: "completely nude, full frontal, bare breasts and vagina visible",
    pose: "standing with weight on one leg, one hand on the mirror, looking at own reflection",
    kind: "gallery",
  },

  // === ON ALL FOURS / DOGGY STYLE ===
  {
    scene: "naakt op handen en knieën op bed, van achteren",
    camera: "low angle from behind, phone held low, looking back over shoulder",
    backdrop: "messy bedroom, rumpled white duvet, pillows scattered",
    lighting: "soft side lighting from window, gentle shadows under body",
    capture: "real amateur self-taken from behind, slight shaky angle",
    outfit: "completely nude, ass and pussy fully visible from behind",
    pose: "on all fours, back arched, looking back at camera over left shoulder",
    kind: "gallery",
  },
  {
    scene: "naakte doggy pose op bed met hoofd op kussen",
    camera: "slightly high angle from behind and to the side",
    backdrop: "cozy bedroom, soft grey bedsheets, fairy lights in background",
    lighting: "warm lamp light from the side, soft and intimate",
    capture: "real self-taken, phone in one hand while posing",
    outfit: "completely nude, pussy and ass prominently visible",
    pose: "face down ass up, knees spread, back deeply arched",
    kind: "gallery",
  },

  // === LYING ON BACK - LEGS SPREAD ===
  {
    scene: "naakt liggend op rug met benen wijd open op bed",
    camera: "high angle looking down, phone held above body",
    backdrop: "white bedsheets, pillows around head, soft daylight",
    lighting: "bright natural daylight from above, soft skin texture visible",
    capture: "real overhead selfie, amateur, slightly imperfect framing",
    outfit: "completely nude, legs spread wide, pussy and breasts fully exposed",
    pose: "lying on back, knees pulled back and spread wide, one hand resting on inner thigh",
    kind: "gallery",
  },
  {
    scene: "naakt liggend op bed met knieën tegen borst",
    camera: "close-up high angle, phone very close to body",
    backdrop: "dark grey sheets, soft pillows, evening light",
    lighting: "soft warm evening light, intimate atmosphere",
    capture: "real close-up self-taken, visible arm holding phone",
    outfit: "completely nude, pussy and anus visible, breasts pushed together",
    pose: "lying on back with knees pulled all the way to chest, legs spread",
    kind: "gallery",
  },

  // === SITTING / KNEELING ===
  {
    scene: "naakt zittend op bed met benen in V-positie",
    camera: "low angle from the front, phone between legs",
    backdrop: "bedroom with string lights, soft pink walls",
    lighting: "mixed warm lamp + cool window light",
    capture: "real self-taken sitting pose, amateur angle",
    outfit: "completely nude, pussy fully visible between spread legs",
    pose: "sitting with legs spread wide in V shape, leaning back on hands",
    kind: "gallery",
  },
  {
    scene: "naakt hurkend voor spiegel in slaapkamer",
    camera: "low angle phone selfie from below while squatting",
    backdrop: "full length mirror, soft carpet, dim bedroom",
    lighting: "low warm lamp light, moody and intimate",
    capture: "real mirror selfie while squatting, phone in hand",
    outfit: "completely nude, pussy visible from low angle",
    pose: "squatting with knees apart, one hand holding phone, other hand on knee",
    kind: "gallery",
  },

  // === STANDING VARIATIONS ===
  {
    scene: "naakt staand voor raam met ochtendlicht",
    camera: "side profile angle, phone held at chest height",
    backdrop: "large window with city view, sheer curtains",
    lighting: "bright backlit morning light, silhouette + rim lighting on body",
    capture: "real self-taken standing pose, natural window light",
    outfit: "completely nude, side view of breasts and ass",
    pose: "standing in profile, one leg slightly forward, looking out the window",
    kind: "gallery",
  },
  {
    scene: "naakt staand in deuropening van slaapkamer",
    camera: "straight on, phone held at arm's length",
    backdrop: "door frame, hallway visible behind, wooden floor",
    lighting: "mixed hallway light and bedroom light",
    capture: "real doorway selfie, slightly wider shot",
    outfit: "completely nude, full frontal standing pose",
    pose: "standing relaxed in doorway, one hand on doorframe, other holding phone",
    kind: "gallery",
  },

  // === BATHROOM VARIATIONS ===
  {
    scene: "naakt liggend in badkuip met benen over rand",
    camera: "high angle from above the tub",
    backdrop: "white bathtub, tiled bathroom walls, plants on edge",
    lighting: "bright bathroom light + window light, water reflections",
    capture: "real overhead bathtub selfie, amateur",
    outfit: "completely nude, legs spread over tub edges, pussy visible",
    pose: "lying in empty bathtub with legs draped over the sides",
    kind: "gallery",
  },
  {
    scene: "naakte badkamer spiegel selfie staand op tenen",
    camera: "low angle, phone held low looking up",
    backdrop: "bathroom mirror, sink visible, towel on rack",
    lighting: "cool bright bathroom lighting, clean and fresh",
    capture: "real standing bathroom mirror selfie on tiptoes",
    outfit: "completely nude, full body from low angle",
    pose: "standing on tiptoes, back slightly arched, phone in both hands",
    kind: "gallery",
  },

  // === BED VARIATIONS ===
  {
    scene: "naakt op buik met kont omhoog op bed",
    camera: "low angle from behind, phone close to ass",
    backdrop: "rumpled bed, pillows, soft blanket",
    lighting: "warm side lighting, shadows on curves",
    capture: "real prone selfie from behind, amateur",
    outfit: "completely nude, ass and pussy from behind, arched back",
    pose: "lying on stomach with ass raised high, knees bent",
    kind: "gallery",
  },
  {
    scene: "naakt zittend op bed met één been opgetild",
    camera: "3/4 angle, phone held to the side",
    backdrop: "bed with white linen, morning light",
    lighting: "soft side light highlighting body curves",
    capture: "real seated pose selfie, natural",
    outfit: "completely nude, one leg raised showing pussy",
    pose: "sitting with one knee up and leg spread, other leg extended",
    kind: "gallery",
  },

  // === MORE CREATIVE POSES ===
  {
    scene: "naakt op handen en voeten met rug gebogen als kat",
    camera: "side angle, phone held low",
    backdrop: "bedroom floor with rug, soft lighting",
    lighting: "dramatic side light, long shadows",
    capture: "real floor-level selfie, dynamic pose",
    outfit: "completely nude, cat pose, back deeply arched",
    pose: "on all fours with extreme back arch, looking to the side",
    kind: "gallery",
  },
  {
    scene: "naakt liggend op zij met één been opgetild",
    camera: "slightly low angle from front",
    backdrop: "bed with pillows, soft blankets",
    lighting: "gentle window light from the side",
    capture: "real side-lying selfie, phone in hand",
    outfit: "completely nude, leg raised showing full pussy",
    pose: "lying on side with top leg pulled up high, hand on thigh",
    kind: "gallery",
  },

  // Add many more variations to reach 100+ total...
  // (Continuing with more templates for real variety)

  {
    scene: "naakte spiegel selfie op knieën voor spiegel",
    camera: "high angle looking down at kneeling body",
    backdrop: "full length mirror, bedroom floor",
    lighting: "soft overhead + window light",
    capture: "real kneeling mirror selfie, phone held high",
    outfit: "completely nude, kneeling with legs spread",
    pose: "kneeling in front of mirror, sitting on heels, legs open",
    kind: "gallery",
  },
  {
    scene: "naakt staand met één been op stoel",
    camera: "low 3/4 angle, phone held at knee height",
    backdrop: "bedroom with chair, soft rug",
    lighting: "warm lamp light from below",
    capture: "real standing pose with leg up, amateur",
    outfit: "completely nude, pussy visible with leg raised",
    pose: "standing with one foot on chair, leg spread wide",
    kind: "gallery",
  },
  {
    scene: "naakte badkamer selfie liggend op badrand",
    camera: "front angle, phone held in front of body",
    backdrop: "bathroom, white tiles, plants",
    lighting: "bright cool bathroom light",
    capture: "real bathroom edge sitting selfie",
    outfit: "completely nude, sitting on tub edge with legs open",
    pose: "sitting on the edge of the bathtub, legs spread toward camera",
    kind: "gallery",
  },
  {
    scene: "naakt op rug met benen in de lucht tegen muur",
    camera: "low angle looking up at body and wall",
    backdrop: "bedroom wall with art, soft lighting",
    lighting: "dramatic low angle lighting",
    capture: "real creative floor selfie, phone on floor",
    outfit: "completely nude, legs up against wall, pussy toward camera",
    pose: "lying on back with legs straight up against the wall",
    kind: "gallery",
  },
  {
    scene: "naakte spiegel selfie met telefoon dichtbij",
    camera: "extreme close-up mirror selfie, phone very close",
    backdrop: "mirror reflection of bedroom",
    lighting: "direct phone flash + soft room light",
    capture: "real close-up mirror selfie, visible phone screen reflection",
    outfit: "completely nude, breasts and pussy in close-up",
    pose: "standing close to mirror, phone almost touching body",
    kind: "gallery",
  },
];

/** Simple in-memory recent-use tracker to avoid repeating the same template too soon for the same persona. */
const recentNudeTemplateUse = new Map<string, number[]>();

/**
 * Pick N unique nude templates, avoiding recently used ones for this persona.
 * Uses camera-family diversity so a batch is not three mirror selfies.
 */
export function pickFreshNudeTemplates(count: number, personaId: string): SceneTemplate[] {
  const pool = [...NUDE_TEMPLATES];
  const recent = recentNudeTemplateUse.get(personaId) ?? [];
  const withIds = pool.map((t, idx) => ({ ...t, id: String(idx) }));
  const excludeIds = recent.map(String);

  let picked = pickDiverseNudeTemplates(withIds, count, { excludeIds });
  if (picked.length < count) {
    picked = pickDiverseNudeTemplates(withIds, count);
  }

  const selected = picked.map(({ id: _id, ...t }) => t);
  const selectedIndices = picked.map((t) => Number(t.id));
  const newRecent = [...recent, ...selectedIndices].slice(-12);
  recentNudeTemplateUse.set(personaId, newRecent);

  return selected;
}
