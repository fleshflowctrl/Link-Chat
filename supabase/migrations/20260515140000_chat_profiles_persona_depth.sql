-- Persona-depth fields for AI personas — drives the system prompt beyond
-- the single-paragraph `bio`. Without these the chat reads as "name + tag
-- line"; with them she has a concrete life (job, daily rhythm, history,
-- goals, pet-names) the model can lean on for callbacks and continuity.
--
-- Fields:
--   * occupation       — concrete profession ("planner bij een marketing-
--                        bureau", "medisch student"). Mentioned naturally.
--   * backstory        — multi-paragraph life-context: where she grew up,
--                        family, recent year, what kind of week. Used in
--                        the prompt as the persona's interior life.
--   * persona_meta     — jsonb bag for the long tail: languages, daily
--                        rhythm, personality traits, goals, pet-names,
--                        relationship-history hint, timezone override,
--                        anything we add later without another migration.
--   * is_archived      — admin "soft hide". Hidden personas are kept for
--                        audit/history but never appear in discovery.
--
-- All fields default to safe empty values so existing rows are valid.
-- The build-grok-system-prompt reader will fold whichever subset is set
-- into the prompt and skip blanks gracefully.

alter table public.chat_profiles
  add column if not exists occupation text not null default '';

alter table public.chat_profiles
  add column if not exists backstory text not null default '';

alter table public.chat_profiles
  add column if not exists persona_meta jsonb;

alter table public.chat_profiles
  add column if not exists is_archived boolean not null default false;

create index if not exists chat_profiles_archived_idx
  on public.chat_profiles (is_archived)
  where is_archived = false;

comment on column public.chat_profiles.occupation is
  'Persona''s job/role in plain text (Dutch). Mentioned naturally in chat for grounding.';
comment on column public.chat_profiles.backstory is
  'Multi-paragraph interior-life description for the AI prompt: childhood, family, recent year, current chapter. The model uses this for callbacks and continuity, never to recite verbatim.';
comment on column public.chat_profiles.persona_meta is
  'JSONB bag: { languages, personality_traits, daily_rhythm, goals, pet_names, relationship_hint, timezone, voice_style }. All keys optional.';
comment on column public.chat_profiles.is_archived is
  'Admin soft-hide. Archived personas keep their data but are filtered out of all public surfaces.';
