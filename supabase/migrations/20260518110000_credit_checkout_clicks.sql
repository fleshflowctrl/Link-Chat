-- Click-tracking for the credits "Betaal" button.
-- Inserted server-side every time a signed-in user POSTs to the credit
-- checkout API (Stripe redirect or dev-purchase). Combined with the
-- credit_purchases table this gives a click → paid conversion rate on
-- the admin dashboard.
--
-- RLS stays on with no public policies — only the service-role API
-- writes/reads. No PII beyond the auth user id.

create table if not exists public.credit_checkout_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  package_id text not null,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  discount numeric(4, 3) not null default 0,
  purchase_count_before integer not null default 0 check (purchase_count_before >= 0),
  /** 'stripe' when a Stripe Checkout session was requested, 'dev' for the
   * local dev-purchase route, 'unknown' as fallback. */
  source text not null default 'stripe',
  created_at timestamptz not null default now()
);

create index if not exists credit_checkout_clicks_user_idx
  on public.credit_checkout_clicks (user_id, created_at desc);

create index if not exists credit_checkout_clicks_created_at_idx
  on public.credit_checkout_clicks (created_at desc);

alter table public.credit_checkout_clicks enable row level security;
