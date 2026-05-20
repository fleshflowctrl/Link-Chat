-- v2 bulk batches: nude vs sexy-clothed photo pipeline.

alter table public.chat_persona_batches
  add column if not exists v2_photo_mode text not null default 'nude'
  check (v2_photo_mode in ('nude', 'sexy-clothed'));

comment on column public.chat_persona_batches.v2_photo_mode is
  'v2 only: nude = full nude template pool; sexy-clothed = lingerie/bikini/sheer, almost nude.';
