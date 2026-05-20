-- Pro subscription (1000 credits / month, min. 12 months in product copy + app logic).

alter table public.user_profiles
  add column if not exists pro_stripe_subscription_id text,
  add column if not exists pro_stripe_customer_id text,
  add column if not exists pro_status text
    check (pro_status is null or pro_status in ('active', 'past_due', 'canceled')),
  add column if not exists pro_started_at timestamptz,
  add column if not exists pro_minimum_end_at timestamptz;

comment on column public.user_profiles.pro_minimum_end_at is
  'Earliest date the user may cancel Pro (started_at + 12 months).';

create table if not exists public.pro_subscription_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_invoice_id text not null unique,
  stripe_subscription_id text,
  granted_credits integer not null check (granted_credits > 0),
  created_at timestamptz not null default now()
);

create index if not exists pro_subscription_grants_user_id_idx
  on public.pro_subscription_grants (user_id, created_at desc);

alter table public.pro_subscription_grants enable row level security;
