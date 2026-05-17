-- Lightweight visitor tracking for the admin metrics dashboard.
-- One row per distinct visitor (identified by a UUID stored in their
-- browser's localStorage). When the visitor signs up we link their auth
-- user id, which lets the metrics page compute:
--   * total visitors
--   * visitor → signup conversion
--   * visitor → first chat conversion
-- Writes happen exclusively through the service-role API; RLS stays on
-- with no public policies so end-users can't read or tamper with the
-- table directly.

create table if not exists public.site_visits (
  visitor_id text primary key,
  first_visit_at timestamptz not null default now(),
  last_visit_at timestamptz not null default now(),
  visit_count integer not null default 1,
  signed_up_user_id uuid references auth.users (id) on delete set null,
  signed_up_at timestamptz,
  user_agent text,
  referrer text
);

create index if not exists site_visits_first_visit_idx
  on public.site_visits (first_visit_at desc);
create index if not exists site_visits_signed_up_user_idx
  on public.site_visits (signed_up_user_id);
create index if not exists site_visits_signed_up_at_idx
  on public.site_visits (signed_up_at desc);

alter table public.site_visits enable row level security;
