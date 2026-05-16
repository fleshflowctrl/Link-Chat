/**
 * Persona identity anchors for photo generation.
 *
 * Why this file exists:
 *   Two personas with the same age tier + body_type + attractiveness
 *   end up with statistically near-identical faces from the diffusion
 *   model even when their seeds differ — diffusion bases trained on
 *   "Dutch woman, 50s, average build, average looks" cluster hard
 *   around the same statistical median. The Grok-written `appearance`
 *   is supposed to differentiate them but is too soft a signal once
 *   the model also sees a generic age/attractiveness anchor.
 *
 *   This module derives a *deterministic* set of concrete physical
 *   tokens from `persona.id` (hair colour, hair style, eye colour,
 *   face shape, distinguishing skin detail, height bracket) and
 *   hands them to the prompt builder as a high-weight identity
 *   block. Same persona id → same tokens forever, so all photos
 *   from a single persona still look like one person. Different
 *   personas → different draws across all six axes → ~2 million
 *   distinct combinations, which is overkill for a few thousand
 *   personas but keeps the birthday-paradox collision rate near
 *   zero.
 *
 *   The lists are deliberately concrete (specific is better — the
 *   model latches onto "donkerbruin haar in een lage staart" but
 *   smooths "casual hair" right out). English-first because
 *   diffusion bases are trained primarily on English captions; a
 *   Dutch tail is included for the few personas where Grok's
 *   `appearance` is also Dutch, so the concatenated prompt reads
 *   consistently.
 */

import type { ChatProfileRow } from "@/lib/chat/map-rows";

/** FNV-1a 32-bit. Same algorithm as scene-templates so identity
 * derivation stays self-contained — no cross-module dependency on a
 * specific hash impl. */
function fnv1a(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(list: readonly T[], seed: number, salt: number): T {
  const h = fnv1a(`${seed}|${salt}`);
  return list[h % list.length]!;
}

// --- Hair colour palettes by age tier ----------------------------------
//
// For 65+ grey/white dominates; 50-64 mixes dyed + greying; under 50
// gets the full Dutch hair-colour spread. We pick on age tier instead
// of exact age so a 49-vs-51 boundary doesn't whiplash visually.

const HAIR_COLOR_YOUNG = [
  "honey-blonde",
  "ash-blonde",
  "dark blonde",
  "platinum blonde",
  "light brown",
  "chestnut brown",
  "dark brown",
  "near-black brown",
  "auburn red",
  "copper red",
  "strawberry blonde",
  "warm caramel brown",
  "dirty blonde",
  "mousy brown",
];

const HAIR_COLOR_50_TO_64 = [
  "dark brown with grey streaks at the temples",
  "dyed chestnut with visible grey roots",
  "dark blonde with greying temples",
  "salt and pepper brown",
  "dyed auburn with some grey",
  "light brown with a few grey hairs",
  "ash brown with subtle grey",
  "dyed warm brown",
];

const HAIR_COLOR_65PLUS = [
  "silver grey",
  "white grey",
  "soft white",
  "steel grey",
  "grey with darker undertones",
  "dyed light brown with grey regrowth",
];

const HAIR_STYLES = [
  "shoulder-length straight",
  "shoulder-length with soft waves",
  "shoulder-length tied in a low ponytail",
  "long straight reaching the mid-back",
  "long with loose beachy waves over the shoulders",
  "long with natural curls",
  "long in a messy high bun",
  "long in a low ponytail",
  "long in two relaxed braids",
  "long in a half-up half-down with a small bun",
  "shoulder-length in a half-up clip",
  "shoulder-length blunt cut right at the shoulders",
  "long loosely pinned up",
  "long curly in a messy bun at the nape",
  "shoulder-length with a side parting",
  "long with a middle parting and slight kink",
];

const EYE_COLORS = [
  "bright blue eyes",
  "light blue eyes",
  "green eyes",
  "hazel eyes",
  "warm brown eyes",
  "dark brown eyes",
  "grey-blue eyes",
  "green-grey eyes",
  "amber-brown eyes",
];

// Face shapes — deliberately a wider spread than the diversifier so
// the silhouettes diverge: round + double chin, narrow long oval,
// strong jaw, soft heart-shape, etc.
const FACE_SHAPES = [
  "round face with full cheeks",
  "heart-shaped face with a narrow chin",
  "oval face with soft features",
  "square face with a defined jawline",
  "long face with a high forehead",
  "round face with a soft double chin",
  "high cheekbones and slim cheeks",
  "narrow jaw and small chin",
  "broad forehead with rounded cheeks",
  "soft jowls and full lower face",
];

const SKIN_DETAILS = [
  "light freckles across the nose and cheeks",
  "rosy complexion that flushes easily",
  "pale skin with faint blue veins at the temples",
  "light summer tan",
  "olive-toned skin",
  "fair skin with a few visible moles",
  "faint acne scars on the chin",
  "pale skin with under-eye shadows",
  "light tan with freckles spreading to the shoulders",
  "smooth matte skin with a soft sheen",
  "ruddy weathered skin from outdoor time",
  "fair skin with a small mole near the lip",
];

const HEIGHT_HINTS = [
  "petite frame, short stature",
  "slightly below average height",
  "average height",
  "slightly above average height",
  "tall frame",
];

// Mouth/teeth detail — a small but very effective face differentiator.
// Diffusion models default to a "nice even smile"; concrete tokens
// here push individual variation in the lower face.
const MOUTH_DETAILS = [
  "small relaxed smile with thin lips",
  "wide bright smile with full upper lip",
  "asymmetric smile that lifts more on one side",
  "small gap between the front teeth visible when smiling",
  "soft closed-mouth smile",
  "warm open smile showing a hint of upper teeth",
  "subtle dimple on one cheek when smiling",
  "slightly crooked lower teeth showing in a casual smile",
];

// Optional distinguishing detail — about half the personas get one.
// Anchors a specific memorable feature so the model commits to it.
const DISTINGUISHING_FEATURES = [
  "small beauty mark above the upper lip",
  "small mole on the left cheek",
  "tiny freckle near the right eye",
  "subtle scar on the chin from childhood",
  "small nose-piercing stud",
  "a single small stud earring visible in one ear",
  "thin gold chain necklace always visible",
  "subtle laugh lines around the eyes",
  "soft fuller eyebrows with a natural arch",
  "thin sparse eyebrows",
  null,
  null,
  null,
  null,
];

export type PersonaPhotoIdentity = {
  hairColor: string;
  hairStyle: string;
  eyeColor: string;
  faceShape: string;
  skinDetail: string;
  mouthDetail: string;
  heightHint: string;
  distinguishingFeature: string | null;
};

function tierForAge(age: number): "young" | "mid" | "old" {
  if (age < 50) return "young";
  if (age < 65) return "mid";
  return "old";
}

function hairPaletteForAge(age: number): readonly string[] {
  const tier = tierForAge(age);
  if (tier === "old") return HAIR_COLOR_65PLUS;
  if (tier === "mid") return HAIR_COLOR_50_TO_64;
  return HAIR_COLOR_YOUNG;
}

/** Derive the full identity descriptor for a persona. Stable across
 * calls for the same id — the picker uses different "salts" per axis
 * so changing one axis's list doesn't reshuffle the other axes. */
export function derivePersonaIdentity(
  personaId: string,
  age: number,
): PersonaPhotoIdentity {
  const seed = fnv1a(personaId);
  return {
    hairColor: pick(hairPaletteForAge(age), seed, 1),
    hairStyle: pick(HAIR_STYLES, seed, 2),
    eyeColor: pick(EYE_COLORS, seed, 3),
    faceShape: pick(FACE_SHAPES, seed, 4),
    skinDetail: pick(SKIN_DETAILS, seed, 5),
    mouthDetail: pick(MOUTH_DETAILS, seed, 6),
    heightHint: pick(HEIGHT_HINTS, seed, 7),
    distinguishingFeature: pick(DISTINGUISHING_FEATURES, seed, 8),
  };
}

/** Render the identity descriptor as a single prompt segment ready
 * to drop into the diffusion prompt. We frontload the phrase
 * "EXACT identity lock" because the diffusion model gives slightly
 * more weight to leading tokens when the segment is positioned near
 * the start of the appearance block. */
export function renderIdentityAnchor(identity: PersonaPhotoIdentity): string {
  const parts: string[] = [
    `EXACT identity lock for this persona, keep these features in every photo of her`,
    `hair: ${identity.hairColor}, ${identity.hairStyle}`,
    `${identity.eyeColor}`,
    `${identity.faceShape}`,
    `${identity.skinDetail}`,
    `${identity.mouthDetail}`,
    `${identity.heightHint}`,
  ];
  if (identity.distinguishingFeature) {
    parts.push(identity.distinguishingFeature);
  }
  return parts.join(", ");
}

/** Convenience: derive + render for callers that don't need to inspect
 * the structured identity. Returns an empty string when we can't pin
 * down an id (defensive; should never trigger in practice). */
export function deriveIdentityPromptSegment(
  profile: Pick<ChatProfileRow, "id" | "age">,
): string {
  if (!profile.id || typeof profile.id !== "string") return "";
  const age =
    typeof profile.age === "number" && Number.isFinite(profile.age)
      ? profile.age
      : 25;
  return renderIdentityAnchor(derivePersonaIdentity(profile.id, age));
}
