-- Tracks how many credit packs a user has bought, so the credits page can apply
-- the diminishing first-time-buyer discount (80% → 50% → 20% → full price).
-- Incremented atomically by /api/me/credits/purchase.
alter table public.user_profiles
  add column if not exists purchase_count integer not null default 0;
