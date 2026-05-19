-- Track which A/B pool a bulk-generate batch targets.

alter table public.chat_persona_batches
  add column if not exists app_variant text not null default 'v1'
  check (app_variant in ('v1', 'v2'));

create index if not exists chat_persona_batches_app_variant_idx
  on public.chat_persona_batches (app_variant, created_at desc);

comment on column public.chat_persona_batches.app_variant is
  'v1 = default pool; v2 = FetLife/kink personas for /v2/* discover.';
