-- Cache the user's current discover pack in home_feed_state so the order
-- stays stable within a slot. Without this, every /discover load rebuilds
-- the pack from history -> profiles the user just saw get pushed to the
-- back mid-session, which means "where I was" becomes a moving target.
--
-- `cached_pack_slot`  : slot id this cache corresponds to. When the active
--                       slot moves past this (timer rotation or paid
--                       refresh) the cache is recomputed.
-- `cached_pack_ids`   : ordered profile ids in the cached pack. Read-time
--                       filtering removes any that the user has since
--                       opened a chat with.

alter table public.home_feed_state
  add column if not exists cached_pack_slot integer,
  add column if not exists cached_pack_ids text[];
