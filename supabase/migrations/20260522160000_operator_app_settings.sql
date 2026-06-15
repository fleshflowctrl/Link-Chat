-- Global operator inbox settings (single row, service-role only).

create table if not exists public.operator_app_settings (
  id integer primary key default 1 check (id = 1),
  ai_auto_reply_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users (id) on delete set null
);

insert into public.operator_app_settings (id, ai_auto_reply_enabled)
values (1, false)
on conflict (id) do nothing;

alter table public.operator_app_settings enable row level security;

-- Allow ai_processing while operator AI auto-reply runs.
alter table public.chat_operator_queue
  drop constraint if exists chat_operator_queue_status_check;

alter table public.chat_operator_queue
  add constraint chat_operator_queue_status_check check (
    operator_status in (
      'open',
      'waiting_operator',
      'ai_processing',
      'replied',
      'closed',
      'archived'
    )
  );
