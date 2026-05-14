-- chat_pending_replies — async delivery queue for AI peer replies.
--
-- Rationale: real people don't reply in <30 seconds every time. They go to
-- the bathroom, the train, sleep. The chat HTTP request can't hold open for
-- 20 minutes (Vercel timeout, blocked workers), so we schedule the reply via
-- this table and let the client trigger delivery at the right time.
--
-- One row per *user* message that is waiting for an AI reply. Multiple rows
-- can exist briefly when the user sends several messages in quick succession;
-- the delivery helper coalesces them into a single Grok call.
--
-- Workflow:
--   POST /messages  -> insert (status='pending', scheduled_at = now + delay)
--   delivery        -> lock-update to 'processing', call Grok with current
--                       full thread, insert peer message, mark 'done'
--   delivery is triggered by:
--     - GET /messages (lazy catch-up when client opens chat)
--     - POST /messages (catch up overdue pendings before returning)
--     - POST /poll-pending (client-side timer fires when scheduled_at hits)
--
-- All writes are owner-scoped via RLS. The `assistant_message_id` link lets
-- analytics tie the realised reply back to the trigger user message.

create table if not exists public.chat_pending_replies (
  user_message_id uuid primary key
    references public.chat_messages (id) on delete cascade,
  owner_user_id uuid not null
    references auth.users (id) on delete cascade,
  peer_id text not null
    references public.chat_profiles (id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed', 'superseded')),
  attempts int not null default 0,
  assistant_message_id uuid
    references public.chat_messages (id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_pending_replies_due_idx
  on public.chat_pending_replies (owner_user_id, peer_id, scheduled_at)
  where status = 'pending';

create index if not exists chat_pending_replies_owner_peer_idx
  on public.chat_pending_replies (owner_user_id, peer_id);

alter table public.chat_pending_replies enable row level security;

drop policy if exists "chat_pending_replies_select_own" on public.chat_pending_replies;
create policy "chat_pending_replies_select_own"
  on public.chat_pending_replies for select to authenticated
  using (owner_user_id = (select auth.uid()));

drop policy if exists "chat_pending_replies_insert_own" on public.chat_pending_replies;
create policy "chat_pending_replies_insert_own"
  on public.chat_pending_replies for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

drop policy if exists "chat_pending_replies_update_own" on public.chat_pending_replies;
create policy "chat_pending_replies_update_own"
  on public.chat_pending_replies for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

drop policy if exists "chat_pending_replies_delete_own" on public.chat_pending_replies;
create policy "chat_pending_replies_delete_own"
  on public.chat_pending_replies for delete to authenticated
  using (owner_user_id = (select auth.uid()));

comment on table public.chat_pending_replies is
  'Async delivery queue for AI peer replies — used to schedule realistic long pauses (10-30+ minutes, sleep windows). One row per user message; coalesced into one Grok call at delivery time.';
