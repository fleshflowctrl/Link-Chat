-- AI chat: per-thread rolling summary + per-turn request logging (RLS: owner only).

create table if not exists public.chat_ai_thread_memory (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  peer_id text not null references public.chat_profiles (id) on delete cascade,
  summary text not null default '',
  prefix_messages_count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (owner_user_id, peer_id)
);

create index if not exists chat_ai_thread_memory_peer_idx
  on public.chat_ai_thread_memory (peer_id);

alter table public.chat_ai_thread_memory enable row level security;

drop policy if exists "chat_ai_thread_memory_select_own" on public.chat_ai_thread_memory;
create policy "chat_ai_thread_memory_select_own"
  on public.chat_ai_thread_memory for select to authenticated
  using (owner_user_id = (select auth.uid()));

drop policy if exists "chat_ai_thread_memory_insert_own" on public.chat_ai_thread_memory;
create policy "chat_ai_thread_memory_insert_own"
  on public.chat_ai_thread_memory for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

drop policy if exists "chat_ai_thread_memory_update_own" on public.chat_ai_thread_memory;
create policy "chat_ai_thread_memory_update_own"
  on public.chat_ai_thread_memory for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create table if not exists public.ai_chat_turn_logs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  peer_id text not null references public.chat_profiles (id) on delete cascade,
  user_message_id uuid references public.chat_messages (id) on delete set null,
  assistant_message_id uuid references public.chat_messages (id) on delete set null,
  model text,
  ok boolean not null default false,
  error text,
  latency_ms int,
  prompt_version text not null default 'v2',
  created_at timestamptz not null default now()
);

create index if not exists ai_chat_turn_logs_owner_peer_created_idx
  on public.ai_chat_turn_logs (owner_user_id, peer_id, created_at desc);

alter table public.ai_chat_turn_logs enable row level security;

drop policy if exists "ai_chat_turn_logs_select_own" on public.ai_chat_turn_logs;
create policy "ai_chat_turn_logs_select_own"
  on public.ai_chat_turn_logs for select to authenticated
  using (owner_user_id = (select auth.uid()));

drop policy if exists "ai_chat_turn_logs_insert_own" on public.ai_chat_turn_logs;
create policy "ai_chat_turn_logs_insert_own"
  on public.ai_chat_turn_logs for insert to authenticated
  with check (owner_user_id = (select auth.uid()));
