-- E-mail when a peer (bot) message stays unread for CHAT_UNREAD_EMAIL_DELAY_MS (default 5 min).
-- One pending row per (owner, peer); new bot messages reset the timer.

create table if not exists public.chat_unread_email_notifications (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  peer_id text not null,
  peer_message_id uuid not null references public.chat_messages (id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'skipped')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists chat_unread_email_one_pending_per_thread
  on public.chat_unread_email_notifications (owner_user_id, peer_id)
  where (status = 'pending');

create index if not exists chat_unread_email_due_idx
  on public.chat_unread_email_notifications (scheduled_at)
  where (status = 'pending');

comment on table public.chat_unread_email_notifications is
  'Postmark reminder queue: notify user if they have not opened a peer message by scheduled_at.';

alter table public.chat_unread_email_notifications enable row level security;
