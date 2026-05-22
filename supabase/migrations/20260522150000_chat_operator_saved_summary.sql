-- Cached Grok operator summaries (regenerate only on explicit request).

create table if not exists public.chat_operator_saved_summary (
  owner_user_id uuid not null,
  peer_id text not null references public.chat_profiles (id) on delete cascade,
  summary text not null,
  message_count int not null default 0,
  generated_at timestamptz not null default now(),
  primary key (owner_user_id, peer_id)
);

comment on table public.chat_operator_saved_summary is
  'Last operator-facing Grok summary per thread; reused until operator clicks regenerate.';
