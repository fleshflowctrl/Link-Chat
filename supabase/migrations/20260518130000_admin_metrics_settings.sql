-- Single-row settings table that powers the resettable "live" metrics
-- view in /admin/metrics. When the admin presses "Reset" we update
-- metrics_since = now() — no data is deleted; the live page just starts
-- counting from that timestamp. /admin/metrics/totaal ignores this
-- setting and keeps showing all-time numbers.

create table if not exists public.admin_metrics_settings (
  id integer primary key default 1 check (id = 1),
  metrics_since timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.admin_metrics_settings (id, metrics_since)
values (1, null)
on conflict (id) do nothing;

alter table public.admin_metrics_settings enable row level security;
-- No public policies: only the service-role API (POST /api/admin/metrics/reset)
-- reads/writes this table.
