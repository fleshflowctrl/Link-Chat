-- Maps Telegram notification message_id → app conversation (for reply-to routing).

create table if not exists public.chat_operator_telegram_map (
  telegram_message_id bigint primary key,
  telegram_chat_id bigint not null,
  owner_user_id uuid not null,
  peer_id text not null,
  conversation_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_operator_telegram_map_conversation_idx
  on public.chat_operator_telegram_map (conversation_id);

comment on table public.chat_operator_telegram_map is
  'Reply-to on a Telegram operator notification resolves to owner_user_id + peer_id.';
