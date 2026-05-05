-- Public bucket for profile photos. Objects live under `{user_id}/...` so RLS can scope writes.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "avatars_select_public" on storage.objects;
create policy "avatars_select_public"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own_folder" on storage.objects;
create policy "avatars_insert_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  );

drop policy if exists "avatars_update_own_folder" on storage.objects;
create policy "avatars_update_own_folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  );

drop policy if exists "avatars_delete_own_folder" on storage.objects;
create policy "avatars_delete_own_folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  );
