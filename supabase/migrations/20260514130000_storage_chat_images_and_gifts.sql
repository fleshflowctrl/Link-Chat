-- Public bucket for chat attachments + extra column for "credit gift" messages.
-- Run after the chat_messages migrations.

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "chat_images_select_public" on storage.objects;
create policy "chat_images_select_public"
  on storage.objects for select
  using (bucket_id = 'chat-images');

drop policy if exists "chat_images_insert_own_folder" on storage.objects;
create policy "chat_images_insert_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  );

drop policy if exists "chat_images_update_own_folder" on storage.objects;
create policy "chat_images_update_own_folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'chat-images'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'chat-images'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  );

drop policy if exists "chat_images_delete_own_folder" on storage.objects;
create policy "chat_images_delete_own_folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  );

-- Allow chat_messages.kind to include 'gift' (credits sent to the peer).
alter table public.chat_messages
  drop constraint if exists chat_messages_kind_check;
alter table public.chat_messages
  add constraint chat_messages_kind_check
  check (kind in ('text', 'image', 'gift'));

alter table public.chat_messages
  add column if not exists gift_credits integer
  check (gift_credits is null or gift_credits > 0);

create index if not exists chat_messages_owner_kind_idx
  on public.chat_messages (owner_user_id, kind)
  where kind = 'gift';
