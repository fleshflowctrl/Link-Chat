/**
 * Form-state types for the admin persona-create/edit experience.
 *
 * These mirror the DB columns 1-to-1 so the form can be a thin wrapper
 * around `parsePersonaPayload` on the server. All fields are kept as
 * strings or simple arrays in the form (even numeric seed) to keep the
 * controlled-input bookkeeping simple — the API does the coercion.
 */

export type Interest = { label: string; icon: string };

export type ChatStyleForm = {
  verbal_tics: string[];
  emoji_palette: string[];
  reply_length: "" | "short" | "medium" | "variable";
  punctuation: "" | "casual" | "clean";
  quirks: string[];
  talks_less_about: string[];
};

export type PhotoStyleForm = {
  appearance: string;
  build: string;
  style: string;
  vibe: string;
  seed: string;
  /** Realism lever: drives diffusion-prompt anchors so the discovery
   * feed has a believable mix of looks. */
  attractiveness: "" | "striking" | "average" | "plain";
  /** Body shape lever — composes independently of attractiveness. */
  body_type: "" | "slim" | "average" | "plus";
};

export type PersonaMetaForm = {
  languages: string[];
  personality_traits: string[];
  daily_rhythm: string;
  goals: string[];
  pet_names: string[];
  relationship_hint: string;
  timezone: string;
  voice_style: string;
};

export type PersonaFormValues = {
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
  interests: Interest[];
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
  joined_at: string;
  chat_style: ChatStyleForm;
  photo_style: PhotoStyleForm;
  persona_meta: PersonaMetaForm;
};

export const FILTER_TAG_OPTIONS: Array<{ id: string; label: string; hint: string }> = [
  { id: "links", label: "Links", hint: "open voor connectie" },
  { id: "active", label: "Actief", hint: "energiek, speels" },
  { id: "replies", label: "Reageert", hint: "aanwezig, attent" },
  { id: "online", label: "Online", hint: "hier-en-nu, direct" },
  { id: "more", label: "Meer", hint: "iets diepere vragen" },
];

export const STATUS_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "active", label: "Active now" },
  { id: "online", label: "Online" },
  { id: "new", label: "New" },
  { id: "popular", label: "Popular" },
  { id: "replied", label: "Replied recently" },
  { id: "quiet", label: "Quiet tonight" },
];

export const ICON_OPTIONS = ["caring", "romantic", "playful", "warm", "listener"];

export function emptyPersonaFormValues(): PersonaFormValues {
  return {
    id: "",
    display_name: "",
    age: 26,
    city: "Amsterdam",
    bio: "",
    occupation: "",
    backstory: "",
    looking_for: "",
    avatar_url: "",
    gallery_urls: [],
    interests: [],
    vibe_tags: [],
    funnel_intent_ids: [],
    filter_tags: ["links", "active", "online"],
    status_variant: "active",
    status_label: "Active now",
    last_active_label: "Active today",
    home_sort: 100,
    distance_km: 4,
    verified: false,
    online_now: true,
    is_archived: false,
    joined_at: new Date().toISOString(),
    chat_style: {
      verbal_tics: [],
      emoji_palette: [],
      reply_length: "short",
      punctuation: "casual",
      quirks: [],
      talks_less_about: [],
    },
    photo_style: {
      appearance: "",
      build: "",
      style: "",
      vibe: "",
      seed: "",
      attractiveness: "",
      body_type: "",
    },
    persona_meta: {
      languages: ["nl"],
      personality_traits: [],
      daily_rhythm: "",
      goals: [],
      pet_names: [],
      relationship_hint: "",
      timezone: "Europe/Amsterdam",
      voice_style: "",
    },
  };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
