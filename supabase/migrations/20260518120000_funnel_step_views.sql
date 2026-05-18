-- Per-step funnel tracking for the onboarding flow on `/`.
--
-- One row per (visitor_id, step) — the primary key guarantees each
-- browser counts at most once per step, so totals = distinct people who
-- reached that step. The admin dashboard derives drop-off by comparing
-- consecutive steps.
--
-- Visitor ids come from the localStorage UUID minted by
-- `lib/analytics/visitor-id.ts` (already used by site_visits / signups).

create table if not exists public.funnel_step_views (
  visitor_id text not null,
  step integer not null check (step >= 1 and step <= 20),
  first_viewed_at timestamptz not null default now(),
  primary key (visitor_id, step)
);

create index if not exists funnel_step_views_step_idx
  on public.funnel_step_views (step, first_viewed_at desc);

create index if not exists funnel_step_views_first_viewed_at_idx
  on public.funnel_step_views (first_viewed_at desc);

alter table public.funnel_step_views enable row level security;
