-- Historical snapshots of the live admin metrics. Whenever the admin
-- resets the live view we freeze the current numbers into one row so
-- they can be revisited (and compared) later.
--
-- `metrics` is the full AdminMetrics payload as JSON so we don't have to
-- migrate the snapshot table every time we add a new metric.
--
-- RLS stays on; only the service-role API reads/writes.

create table if not exists public.admin_metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  /** When the snapshot was taken (= when reset was pressed). */
  taken_at timestamptz not null default now(),
  /** Beginning of the snapshotted period (previous metrics_since, or
   *  null when the snapshot covers all-time before the first reset). */
  period_start timestamptz,
  /** End of the snapshotted period — always equals taken_at. */
  period_end timestamptz not null default now(),
  /** Optional human label entered in the reset modal. */
  label text,
  /** Full AdminMetrics object captured at taken_at. */
  metrics jsonb not null
);

create index if not exists admin_metrics_snapshots_taken_at_idx
  on public.admin_metrics_snapshots (taken_at desc);

alter table public.admin_metrics_snapshots enable row level security;
