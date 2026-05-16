-- Realism v2: stronger humanisation layers.
--
-- Adds three things:
--   1. Voice fingerprint (per persona) — signature words/emoji/quirks that
--      get HARD-injected into replies, not just suggested in the prompt.
--   2. Persona self-memory — what SHE has said about herself, separate
--      from facts about the user. Prevents self-contradiction.
--   3. No new tables — both layers piggyback on existing columns:
--        chat_profiles.chat_style (jsonb)  -> add signature_word, signature_emoji, etc. keys
--        chat_ai_thread_memory.persona_self_facts (new jsonb column)
--
-- All keys / column are optional; missing values fall back to existing
-- behaviour, so no row backfill is required.

-- ----- 1. Persona self-memory column on chat_ai_thread_memory --------
alter table public.chat_ai_thread_memory
  add column if not exists persona_self_facts jsonb;

comment on column public.chat_ai_thread_memory.persona_self_facts is
  'Things the AI persona has claimed about herself in this thread (work, hobbies, food preferences, plans). Used to prevent self-contradiction.';

-- ----- 2. (No new column needed for chat_style) -----------------------
-- The chat_style jsonb already accepts arbitrary keys. The realism v2
-- code reads three optional new keys:
--   signature_words   string[]   max ~3 — must appear in 30%+ of messages
--   signature_emojis  string[]   max ~3 — preferred emoji combos
--   signature_quirk   string     a structural writing quirk
-- All are validated client-side; no schema changes required here.

-- ----- 3. Sanity comment ----------------------------------------------
comment on column public.chat_profiles.chat_style is
  'Optional persona texture for AI chat: verbal tics, emoji palette, reply length, quirks, signature_words, signature_emojis, signature_quirk. See lib/ai/voice-fingerprint.ts for the v2 hard-enforced fields.';
