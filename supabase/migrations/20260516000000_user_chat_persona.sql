-- Cross-conversation user profile.
--
-- Aggregates ALL messages a user has ever sent across all chat threads
-- so that every persona they chat with can adapt their tone, flirt
-- level, pace, and topical hooks to who this user actually is.
--
-- The blob is computed by a Grok summarisation pass (see
-- lib/ai/user-cross-chat-profile.ts) every time the user has sent
-- ~messages_threshold new messages since the last refresh. This keeps
-- the cost bounded while still adapting reasonably fast to behaviour
-- shifts.
--
-- One row per user. Columns:
--   summary           — natural-language paragraph used in the prompt
--   traits            — short list of personality traits (jsonb array)
--   topics            — recurring topics / interests (jsonb array)
--   flirt_level       — "low" | "medium" | "high" | "explicit"
--   communication_pace— "slow" | "normal" | "rapid"
--   message_length    — "short" | "medium" | "long"
--   wants             — list of things the user clearly wants/likes
--   avoids            — list of things the user dislikes / shuts down
--   messages_analyzed — counter, how many messages contributed
--   updated_at        — last refresh timestamp
--
-- RLS: owners only.

create table if not exists public.user_chat_persona (
  user_id uuid primary key references auth.users (id) on delete cascade,
  summary text not null default '',
  traits jsonb not null default '[]'::jsonb,
  topics jsonb not null default '[]'::jsonb,
  flirt_level text not null default 'medium',
  communication_pace text not null default 'normal',
  message_length text not null default 'medium',
  wants jsonb not null default '[]'::jsonb,
  avoids jsonb not null default '[]'::jsonb,
  messages_analyzed int not null default 0,
  updated_at timestamptz not null default now(),
  constraint user_chat_persona_flirt_level_check
    check (flirt_level in ('low', 'medium', 'high', 'explicit')),
  constraint user_chat_persona_pace_check
    check (communication_pace in ('slow', 'normal', 'rapid')),
  constraint user_chat_persona_message_length_check
    check (message_length in ('short', 'medium', 'long'))
);

comment on table public.user_chat_persona is
  'Cross-conversation summary of a user''s chatting style and preferences. Injected into every persona''s system prompt so chats adapt to who this user is across all threads.';

alter table public.user_chat_persona enable row level security;

drop policy if exists "user_chat_persona_select_own" on public.user_chat_persona;
create policy "user_chat_persona_select_own"
  on public.user_chat_persona for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "user_chat_persona_insert_own" on public.user_chat_persona;
create policy "user_chat_persona_insert_own"
  on public.user_chat_persona for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "user_chat_persona_update_own" on public.user_chat_persona;
create policy "user_chat_persona_update_own"
  on public.user_chat_persona for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
