-- Cutoff for the "Live" period on /admin/roadmap (independent of metrics_since_v2).

alter table public.admin_metrics_settings
  add column if not exists funnel_since_v2 timestamptz;
