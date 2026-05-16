-- Blurred explicit photos in chat (pay-to-unlock).
--
-- When a persona sends a truly explicit nude photo (after negotiation),
-- we store it with blur_cost = 50. The user sees a blurred thumbnail
-- and must pay 50 credits to unlock the full-resolution image.
--
-- Per-user unlocks are tracked in chat_photo_unlocks so different
-- accounts don't share unlocks.

-- 1. Extend chat_messages with blur metadata
alter table public.chat_messages
  add column if not exists blur_cost integer not null default 0;

-- 2. Per-user unlock records for specific chat photos
create table if not exists public.chat_photo_unlocks (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  credits_paid integer not null,
  unlocked_at timestamptz not null default now(),
  primary key (owner_user_id, message_id)
);

create index if not exists chat_photo_unlocks_message_idx
  on public.chat_photo_unlocks (message_id);

alter table public.chat_photo_unlocks enable row level security;

drop policy if exists "chat_photo_unlocks_select_own" on public.chat_photo_unlocks;
create policy "chat_photo_unlocks_select_own"
  on public.chat_photo_unlocks for select to authenticated
  using (owner_user_id = (select auth.uid()));

drop policy if exists "chat_photo_unlocks_insert_own" on public.chat_photo_unlocks;
create policy "chat_photo_unlocks_insert_own"
  on public.chat_photo_unlocks for insert to authenticated
  with check (owner_user_id = (select auth.uid()));

drop policy if exists "chat_photo_unlocks_update_own" on public.chat_photo_unlocks;
create policy "chat_photo_unlocks_update_own"
  on public.chat_photo_unlocks for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));
