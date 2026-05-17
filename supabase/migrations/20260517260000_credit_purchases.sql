-- Idempotent record of completed Stripe (or dev) credit purchases.
-- Webhook inserts by stripe_checkout_session_id so retries never double-grant.

create table if not exists public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  package_id text not null,
  stripe_checkout_session_id text unique,
  amount_cents integer not null check (amount_cents >= 0),
  granted_credits integer not null check (granted_credits > 0),
  purchase_count_before integer not null default 0 check (purchase_count_before >= 0),
  discount_applied numeric(4, 3) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists credit_purchases_user_id_idx
  on public.credit_purchases (user_id, created_at desc);

alter table public.credit_purchases enable row level security;

-- No public policies: only service-role API / webhooks touch this table.
