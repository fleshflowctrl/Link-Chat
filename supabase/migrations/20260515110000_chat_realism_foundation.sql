-- Foundational schema upgrades for the realism push:
--
-- 1. chat_messages.peer_read_at  — set when the AI persona "sees" a user
--    message (a few seconds to minutes after arrival, depending on her
--    engagement state). Drives the per-message "Read at HH:MM" indicator
--    that real iMessage shows. Distinct from chat_reads (which tracks the
--    USER's last-read time on this thread for the unread badge).
--
-- 2. chat_pending_replies  — extended to support spontaneous AI-initiated
--    messages (re-engagement after user goes silent, winback after days of
--    silence) and pre-ack chunks (a quick reaction before the real reply).
--    `user_message_id` becomes nullable; new `kind` column distinguishes
--    'reply' (default), 'spontaneous', 'winback', 'pre_ack', 'chunk'.
--    A new (owner, peer, kind, scheduled_at) lookup index lets the
--    spontaneous-scheduler avoid double-queueing the same kind.
--
-- 3. chat_ai_thread_memory.structured_facts  — JSONB blob of structured
--    extracted facts, open-loops and inside-jokes. Built up incrementally
--    instead of (or alongside) the prose summary. Lets the prompt do
--    sharper callbacks ("vergeet niet je morgen iets te vertellen over X")
--    than a folded summary can.

----------------------------------------------------------------------
-- 1. chat_messages: peer_read_at for "Read at" indicator
----------------------------------------------------------------------
alter table public.chat_messages
  add column if not exists peer_read_at timestamptz;

create index if not exists chat_messages_peer_read_idx
  on public.chat_messages (peer_id, owner_user_id, peer_read_at)
  where peer_read_at is not null;

comment on column public.chat_messages.peer_read_at is
  'Timestamp at which the AI peer "saw" this user message. Drives the per-message read receipt. NULL on peer messages and on user messages still pending peer read.';

----------------------------------------------------------------------
-- 2. chat_pending_replies: support spontaneous + pre_ack + chunk kinds
----------------------------------------------------------------------

-- The original PK was user_message_id (uuid). We need a surrogate id so
-- spontaneous/winback rows can exist without a trigger message and
-- multiple pending rows can coexist per thread.
--
-- We do this in idempotent steps so re-running the migration is safe:
--   (a) add the surrogate id column (with a default so existing rows
--       backfill on the fly)
--   (b) backfill any null ids (defensive — shouldn't normally trigger)
--   (c) drop whatever the current primary key is
--   (d) make id NOT NULL and the new primary key
--   (e) only THEN can we drop NOT NULL on user_message_id (would fail
--       with 42P16 "column is in a primary key" otherwise)

alter table public.chat_pending_replies
  add column if not exists id uuid default gen_random_uuid();

update public.chat_pending_replies set id = gen_random_uuid() where id is null;

alter table public.chat_pending_replies
  drop constraint if exists chat_pending_replies_pkey;

alter table public.chat_pending_replies
  alter column id set not null;

alter table public.chat_pending_replies
  add constraint chat_pending_replies_pkey primary key (id);

alter table public.chat_pending_replies
  alter column user_message_id drop not null;

create unique index if not exists chat_pending_replies_user_message_unique
  on public.chat_pending_replies (user_message_id)
  where user_message_id is not null;

-- New: kind column to distinguish reply vs spontaneous types.
alter table public.chat_pending_replies
  add column if not exists kind text not null default 'reply'
    check (kind in ('reply', 'spontaneous', 'winback', 'pre_ack', 'chunk'));

-- Optional: parent user message id for spontaneous types whose context
-- is "the user hasn't responded since this message of theirs". For chunk
-- kind, references the original trigger user message.
alter table public.chat_pending_replies
  add column if not exists parent_user_message_id uuid
    references public.chat_messages (id) on delete set null;

-- Optional: payload for chunk delivery — when we're scheduling the 2nd/3rd
-- bubble of a multi-message reply, the body text is computed up front and
-- stored here so delivery doesn't need another Grok call.
alter table public.chat_pending_replies
  add column if not exists payload_text text;

create index if not exists chat_pending_replies_kind_idx
  on public.chat_pending_replies (owner_user_id, peer_id, kind, scheduled_at)
  where status = 'pending';

comment on column public.chat_pending_replies.kind is
  'reply: standard delayed AI reply to a user message. spontaneous: AI initiates after user silence (~30-90min). winback: AI re-engages after 1-3 days of inactivity. pre_ack: quick reaction sent before the real reply. chunk: 2nd/3rd bubble of a multi-message reply.';

----------------------------------------------------------------------
-- 3. chat_ai_thread_memory: structured_facts for sharp callbacks
----------------------------------------------------------------------
alter table public.chat_ai_thread_memory
  add column if not exists structured_facts jsonb;

comment on column public.chat_ai_thread_memory.structured_facts is
  'Structured extraction of the conversation: { facts_about_her, facts_about_us, open_loops, inside_jokes, callback_hooks }. Used by the system prompt for sharp specific callbacks instead of vague summary references.';
