-- One Telegram forum topic per app conversation (user + persona) in the operator group.

create table if not exists public.chat_operator_telegram_topics (
  conversation_id text primary key,
  owner_user_id uuid not null,
  peer_id text not null,
  telegram_chat_id bigint not null,
  message_thread_id bigint not null,
  topic_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists chat_operator_telegram_topics_thread_idx
  on public.chat_operator_telegram_topics (telegram_chat_id, message_thread_id);

comment on table public.chat_operator_telegram_topics is
  'Maps app conversation to Telegram forum topic for isolated operator threads.';
