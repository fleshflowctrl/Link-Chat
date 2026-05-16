-- Backfill chat_profiles.joined_at with a real timestamp and add a
-- default so newly inserted personas land on top of the admin list
-- without the route having to think about it.
--
-- Why: the admin /admin/personas page sorts by joined_at desc to put
-- the newest persona first. Existing rows with null joined_at would
-- end up clumped together at the bottom; this fills them with the
-- earliest sensible value (their first chat_message timestamp,
-- falling back to now() - 30 days for personas that never chatted).

alter table public.chat_profiles
  alter column joined_at set default now();

-- Backfill: for any persona without joined_at, set it to either the
-- timestamp of her oldest chat_message (proxy for "when she joined")
-- or now() - 30 days as a stable default for never-chatted personas.
update public.chat_profiles cp
set joined_at = coalesce(
  (select min(cm.created_at)
     from public.chat_messages cm
     where cm.peer_id = cp.id),
  now() - interval '30 days'
)
where joined_at is null;

create index if not exists chat_profiles_joined_at_desc_idx
  on public.chat_profiles (joined_at desc);

comment on column public.chat_profiles.joined_at is
  'When this persona "joined" the app — used for newest-first sorting in admin and discovery. Defaults to now() so fresh inserts land on top.';
