-- Operator inbox queue for manual replies (replaces auto-AI when MANUAL_OPERATOR_MODE=1).

create table if not exists public.chat_operator_queue (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  peer_id text not null references public.chat_profiles (id) on delete cascade,
  needs_operator_reply boolean not null default true,
  assigned_operator_id uuid null references auth.users (id) on delete set null,
  last_user_message_at timestamptz null,
  last_operator_reply_at timestamptz null,
  last_message_preview text null,
  unread_for_operator boolean not null default true,
  operator_status text not null default 'waiting_operator',
  priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_operator_queue_owner_peer_unique unique (owner_user_id, peer_id),
  constraint chat_operator_queue_status_check check (
    operator_status in (
      'open',
      'waiting_operator',
      'replied',
      'closed',
      'archived'
    )
  )
);

create index if not exists chat_operator_queue_inbox_idx
  on public.chat_operator_queue (operator_status, unread_for_operator, last_user_message_at asc nulls last);

create index if not exists chat_operator_queue_priority_idx
  on public.chat_operator_queue (priority desc, last_user_message_at asc nulls last);

comment on table public.chat_operator_queue is
  'One row per (owner_user_id, peer_id) thread needing operator attention.';

-- Optional source tag on messages (operator vs user vs legacy AI).
alter table public.chat_messages
  add column if not exists message_source text null;

comment on column public.chat_messages.message_source is
  'e.g. operator_manual, user, ai_auto — nullable for legacy rows.';

-- Extend pending status for manual-mode cancellation (status is free text).
comment on column public.chat_pending_replies.status is
  'pending | processing | done | failed | superseded | cancelled_manual_operator_mode';
