/**
 * Validation + normalisation for the admin persona create/update payload.
 *
 * The admin form sends a single JSON body covering all chat_profiles
 * columns the operator can touch (everything except runtime state like
 * last_message_*). This module turns the wire shape into a clean DB
 * insert/update record with type-correct values, sensible defaults, and
 * tight bounds (so a typo in the form can't poison the discovery feed).
 *
 * Returns either:
 *   { ok: true, row } — ready-to-pass to supabase.from('chat_profiles')
 *   { ok: false, error } — short Dutch error, suitable for surfacing
 */

import { FUNNEL_LOOKING_ID_SET, FUNNEL_VIBE_ID_SET } from "@/data/funnel";

const SLUG_RE = /^[a-z][a-z0-9_-]{1,40}$/;
const URL_RE = /^https?:\/\//i;

const STATUS_VARIANTS = new Set([
  "active",
  "replied",
  "new",
  "popular",
  "quiet",
  "online",
]);

const FILTER_TAG_VALUES = new Set([
  "links",
  "active",
  "replies",
  "online",
  "more",
]);

const REPLY_LENGTHS = new Set(["short", "medium", "variable"]);
const PUNCTUATIONS = new Set(["casual", "clean"]);

function asString(v: unknown, max = 4000): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function asNumber(v: unknown, fallback: number, lo = 0, hi = 999): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.max(lo, Math.min(hi, Math.round(v)));
  }
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(lo, Math.min(hi, Math.round(n)));
  }
  return fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /^(1|true|yes|on)$/i.test(v.trim());
  return fallback;
}

function asStringArray(v: unknown, max = 20, perItemMax = 80): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = asString(item, perItemMax);
    if (!s) continue;
    if (out.length >= max) break;
    out.push(s);
  }
  return Array.from(new Set(out));
}

function asUrlArray(v: unknown, max = 12): string[] {
  return asStringArray(v, max, 1000).filter((u) => URL_RE.test(u));
}

function asInterestArray(v: unknown): Array<{ label: string; icon: string }> {
  if (!Array.isArray(v)) return [];
  const out: Array<{ label: string; icon: string }> = [];
  const allowedIcons = new Set([
    "caring",
    "romantic",
    "playful",
    "warm",
    "listener",
  ]);
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = asString(o.label, 32);
    const iconRaw = asString(o.icon, 16).toLowerCase();
    if (!label) continue;
    const icon = allowedIcons.has(iconRaw) ? iconRaw : "warm";
    if (out.length >= 8) break;
    out.push({ label, icon });
  }
  return out;
}

type ChatStyle = {
  verbal_tics?: string[];
  emoji_palette?: string[];
  reply_length?: string;
  punctuation?: string;
  quirks?: string[];
  talks_less_about?: string[];
};

function asChatStyle(v: unknown): ChatStyle | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const out: ChatStyle = {};
  const tics = asStringArray(o.verbal_tics, 12, 32);
  if (tics.length) out.verbal_tics = tics;
  const palette = asStringArray(o.emoji_palette, 10, 8);
  if (palette.length) out.emoji_palette = palette;
  const rl = asString(o.reply_length, 16);
  if (REPLY_LENGTHS.has(rl)) out.reply_length = rl;
  const punc = asString(o.punctuation, 16);
  if (PUNCTUATIONS.has(punc)) out.punctuation = punc;
  const quirks = asStringArray(o.quirks, 8, 120);
  if (quirks.length) out.quirks = quirks;
  const less = asStringArray(o.talks_less_about, 8, 60);
  if (less.length) out.talks_less_about = less;
  return Object.keys(out).length > 0 ? out : null;
}

type PhotoStyle = {
  appearance?: string;
  build?: string;
  style?: string;
  vibe?: string;
  seed?: number;
  /** Visual attractiveness tier the photo-prompt builder should bias
   * toward. Default is "average" because making every persona model-tier
   * makes the discovery feed feel like a scam. The tiers are NOT moral
   * judgements — they're realism levers:
   *   "striking" — model-tier, glossy, polished
   *   "average"  — gemiddelde Nederlandse vrouw, alledaags, herkenbaar
   *   "plain"    — onopvallend, niet-perfect, maar warm en authentiek */
  attractiveness?: "striking" | "average" | "plain";
  /** Body shape tier — independent of attractiveness so any combination
   * is valid (e.g. plus-size + striking is a perfectly normal real
   * person). Drives diffusion build/silhouette anchors. */
  body_type?: "slim" | "average" | "plus";
};

const ATTRACTIVENESS = new Set<NonNullable<PhotoStyle["attractiveness"]>>([
  "striking",
  "average",
  "plain",
]);

const BODY_TYPES = new Set<NonNullable<PhotoStyle["body_type"]>>([
  "slim",
  "average",
  "plus",
]);

function asPhotoStyle(v: unknown): PhotoStyle | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const out: PhotoStyle = {};
  const a = asString(o.appearance, 600);
  if (a) out.appearance = a;
  const b = asString(o.build, 200);
  if (b) out.build = b;
  const s = asString(o.style, 300);
  if (s) out.style = s;
  const vibe = asString(o.vibe, 200);
  if (vibe) out.vibe = vibe;
  if (typeof o.seed === "number" && Number.isFinite(o.seed)) {
    out.seed = Math.floor(o.seed) >>> 0;
  } else if (typeof o.seed === "string" && o.seed.trim()) {
    const n = Number(o.seed);
    if (Number.isFinite(n)) out.seed = Math.floor(n) >>> 0;
  }
  const attr = asString(o.attractiveness, 16).toLowerCase();
  if (ATTRACTIVENESS.has(attr as PhotoStyle["attractiveness"] & string)) {
    out.attractiveness = attr as PhotoStyle["attractiveness"];
  }
  const bt = asString(o.body_type, 16).toLowerCase();
  if (BODY_TYPES.has(bt as PhotoStyle["body_type"] & string)) {
    out.body_type = bt as PhotoStyle["body_type"];
  }
  return Object.keys(out).length > 0 ? out : null;
}

type PersonaMeta = {
  languages?: string[];
  personality_traits?: string[];
  daily_rhythm?: string;
  goals?: string[];
  pet_names?: string[];
  relationship_hint?: string;
  timezone?: string;
  voice_style?: string;
};

function asPersonaMeta(v: unknown): PersonaMeta | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const out: PersonaMeta = {};
  const langs = asStringArray(o.languages, 6, 8);
  if (langs.length) out.languages = langs;
  const traits = asStringArray(o.personality_traits, 8, 60);
  if (traits.length) out.personality_traits = traits;
  const rhythm = asString(o.daily_rhythm, 800);
  if (rhythm) out.daily_rhythm = rhythm;
  const goals = asStringArray(o.goals, 6, 120);
  if (goals.length) out.goals = goals;
  const pets = asStringArray(o.pet_names, 6, 24);
  if (pets.length) out.pet_names = pets;
  const relHint = asString(o.relationship_hint, 600);
  if (relHint) out.relationship_hint = relHint;
  const tz = asString(o.timezone, 64);
  if (tz) out.timezone = tz;
  const voice = asString(o.voice_style, 200);
  if (voice) out.voice_style = voice;
  return Object.keys(out).length > 0 ? out : null;
}

export type PersonaInsertRow = {
  id: string;
  display_name: string;
  age: number;
  city: string;
  bio: string;
  occupation: string;
  backstory: string;
  looking_for: string;
  avatar_url: string;
  gallery_urls: string[];
  interests: Array<{ label: string; icon: string }>;
  vibe_tags: string[];
  funnel_intent_ids: string[];
  filter_tags: string[];
  status_variant: string;
  status_label: string;
  last_active_label: string;
  home_sort: number;
  distance_km: number;
  verified: boolean;
  online_now: boolean;
  is_archived: boolean;
  is_ai: true;
  joined_at: string;
  chat_style: ChatStyle | null;
  photo_style: PhotoStyle | null;
  persona_meta: PersonaMeta | null;
};

export type ParsePersonaResult =
  | { ok: true; row: PersonaInsertRow }
  | { ok: false; error: string };

/** Parse + normalise the admin form payload. `mode='create'` enforces the
 * full required-set; `mode='update'` allows partial inputs by reusing
 * `existing` as a baseline. */
export function parsePersonaPayload(
  payload: unknown,
  args: { mode: "create" | "update"; existing?: Partial<PersonaInsertRow> } = { mode: "create" },
): ParsePersonaResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Geen gegevens ontvangen." };
  }
  const p = payload as Record<string, unknown>;
  const e = args.existing ?? {};

  const id = asString(p.id ?? e.id, 60).toLowerCase();
  if (!id || !SLUG_RE.test(id)) {
    return { ok: false, error: "ID ongeldig — alleen kleine letters/cijfers/_/-, max 40 tekens." };
  }

  const display_name = asString(p.display_name ?? e.display_name, 60);
  if (!display_name) {
    return { ok: false, error: "Naam is verplicht." };
  }

  const age = asNumber(p.age ?? e.age, 25, 18, 99);
  const city = asString(p.city ?? e.city, 80) || "Amsterdam";
  const bio = asString(p.bio ?? e.bio, 800);
  const occupation = asString(p.occupation ?? e.occupation, 200);
  const backstory = asString(p.backstory ?? e.backstory, 4000);
  const looking_for = asString(p.looking_for ?? e.looking_for, 200);

  let avatar_url = asString(p.avatar_url ?? e.avatar_url, 1000);
  if (avatar_url && !URL_RE.test(avatar_url)) {
    return { ok: false, error: "Avatar-URL moet beginnen met http(s)://." };
  }
  if (!avatar_url && args.mode === "create") {
    return { ok: false, error: "Avatar-URL is verplicht (upload of plak een https URL)." };
  }

  const gallery_urls = asUrlArray(p.gallery_urls ?? e.gallery_urls);

  const interests = asInterestArray(p.interests ?? e.interests);

  const vibe_tags = asStringArray(p.vibe_tags ?? e.vibe_tags, 12, 32).filter((id) =>
    FUNNEL_VIBE_ID_SET.has(id),
  );
  const funnel_intent_ids = asStringArray(p.funnel_intent_ids ?? e.funnel_intent_ids, 6, 32).filter(
    (id) => FUNNEL_LOOKING_ID_SET.has(id),
  );
  const filter_tags = asStringArray(p.filter_tags ?? e.filter_tags, 6, 24).filter((t) =>
    FILTER_TAG_VALUES.has(t),
  );

  const status_variant_raw = asString(p.status_variant ?? e.status_variant, 24) || "active";
  const status_variant = STATUS_VARIANTS.has(status_variant_raw) ? status_variant_raw : "active";
  const status_label = asString(p.status_label ?? e.status_label, 60) || "Active now";
  const last_active_label = asString(p.last_active_label ?? e.last_active_label, 60) || "Active today";

  const home_sort = asNumber(p.home_sort ?? e.home_sort, 100, 1, 9999);
  const distance_km = asNumber(p.distance_km ?? e.distance_km, 4, 0, 200);

  const verified = asBool(p.verified ?? e.verified, false);
  const online_now = asBool(p.online_now ?? e.online_now, false);
  const is_archived = asBool(p.is_archived ?? e.is_archived, false);

  const joinedAtRaw = (p.joined_at ?? e.joined_at) as unknown;
  let joined_at: string;
  if (typeof joinedAtRaw === "string" && joinedAtRaw.trim()) {
    const t = new Date(joinedAtRaw);
    joined_at = Number.isNaN(t.getTime()) ? new Date().toISOString() : t.toISOString();
  } else {
    joined_at = new Date().toISOString();
  }

  const chat_style = asChatStyle(p.chat_style ?? e.chat_style ?? null);
  const photo_style = asPhotoStyle(p.photo_style ?? e.photo_style ?? null);
  const persona_meta = asPersonaMeta(p.persona_meta ?? e.persona_meta ?? null);

  const row: PersonaInsertRow = {
    id,
    display_name,
    age,
    city,
    bio,
    occupation,
    backstory,
    looking_for,
    avatar_url,
    gallery_urls,
    interests,
    vibe_tags,
    funnel_intent_ids,
    filter_tags,
    status_variant,
    status_label,
    last_active_label,
    home_sort,
    distance_km,
    verified,
    online_now,
    is_archived,
    is_ai: true,
    joined_at,
    chat_style,
    photo_style,
    persona_meta,
  };

  return { ok: true, row };
}
