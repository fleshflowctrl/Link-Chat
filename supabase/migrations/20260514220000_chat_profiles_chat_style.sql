-- chat_profiles.chat_style — optional structured persona styling for AI replies.
-- The build-grok-system-prompt reader treats every key as optional and falls
-- back gracefully when missing, so existing rows need no backfill.
--
-- Suggested shape (all keys optional):
-- {
--   "verbal_tics":   ["joh","ofzo","echt waar"],   -- words/phrases this persona drops naturally
--   "emoji_palette": ["🙈","🥹","😅"],              -- preferred emoji set (tiny, ~2-5)
--   "reply_length":  "short"|"medium"|"variable",  -- typical reply rhythm
--   "punctuation":   "casual"|"clean",             -- drops dots / lowercase tendency
--   "quirks":        ["luistert dezelfde 4 nummers tot ze ze haat"],
--   "talks_less_about": ["familie","vorige relatie"]
-- }
--
-- This column is server-side metadata used to texture the system prompt.
-- It is NEVER shown verbatim in chat — only its influence on style.

alter table public.chat_profiles
  add column if not exists chat_style jsonb;

comment on column public.chat_profiles.chat_style is
  'Optional persona texture for AI chat: verbal tics, emoji palette, reply length, quirks. See migration header for shape.';
