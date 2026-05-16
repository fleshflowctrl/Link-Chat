-- Admin auto-generate batches — server-side queue so persona generation
-- keeps running even when the admin closes the browser tab.
--
-- The previous design ran the full pipeline (Grok profile, avatar photo,
-- 3 gallery photos × N personas) entirely from the BulkGenerateCard
-- component. That meant:
--   1) personas were processed phase-by-phase across the whole batch
--      (all profiles first, then all avatars, then all galleries), so
--      the first persona only got her gallery after every other persona
--      had also written her profile + rendered her avatar.
--   2) navigating away from the admin/personas page aborted every
--      in-flight fetch, leaving half-finished personas behind.
--
-- New flow:
--   1) Admin POSTs /api/admin/personas/batch/start which writes a
--      `chat_persona_batches` row + one `chat_persona_batch_items`
--      row per persona, then fires off the first /batch/tick request.
--   2) Each /batch/tick invocation picks the FIRST item that still has
--      work to do (profile → avatar → gallery photos in order, per
--      persona) and processes ONE unit of work, then triggers another
--      /batch/tick before returning. Each unit stays inside Vercel's
--      60s function budget.
--   3) The admin UI polls /api/admin/personas/batch/{id} every couple
--      of seconds for progress. If the admin leaves and returns the
--      batchId in localStorage lets us pick the view back up.
--
-- Service-role only — the worker uses the service key for everything
-- (admin sessions can disappear mid-batch). RLS is enabled and locked
-- to the row owner for any direct client read; the admin UI also reads
-- via the server route which uses the service key.

create table if not exists public.chat_persona_batches (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'cancelled', 'failed')),
  brief text not null,
  total int not null check (total > 0 and total <= 20),
  with_photos boolean not null default true,
  attractiveness text not null default 'average'
    check (attractiveness in ('striking', 'average', 'plain')),
  body_type text not null default 'average'
    check (body_type in ('slim', 'average', 'plus')),
  age_min int not null default 22 check (age_min between 18 and 99),
  age_max int not null default 30 check (age_max between 18 and 99),
  gallery_target int not null default 3 check (gallery_target between 0 and 10),
  -- Batch-wide random offset so different bulk runs cycle through the
  -- scene-template set differently. Set once at start.
  scene_offset int not null default 0,
  -- IDs and display names already produced; appended to as each profile
  -- is written so Grok can exclude them on the next profile.
  exclude_ids jsonb not null default '[]'::jsonb,
  exclude_names jsonb not null default '[]'::jsonb,
  -- Last error captured by a tick; cleared on next success.
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists chat_persona_batches_owner_idx
  on public.chat_persona_batches (owner_user_id, created_at desc);

create index if not exists chat_persona_batches_active_idx
  on public.chat_persona_batches (status, updated_at)
  where status in ('pending', 'running');

comment on table public.chat_persona_batches is
  'Admin bulk-generate jobs. One row per batch; per-persona progress lives in chat_persona_batch_items. Worker (/api/admin/personas/batch/tick) processes items sequentially per persona.';

create table if not exists public.chat_persona_batch_items (
  batch_id uuid not null references public.chat_persona_batches (id) on delete cascade,
  -- 0-based position within the batch; combined with batch_id forms PK.
  idx int not null,
  -- Phase-1 (Grok profile + insert): pending → running → done | error
  profile_state text not null default 'pending'
    check (profile_state in ('pending', 'running', 'done', 'error', 'skipped')),
  -- Phase-2 (avatar): pending → running → done | error | skipped
  photo_state text not null default 'pending'
    check (photo_state in ('pending', 'running', 'done', 'error', 'skipped')),
  -- Phase-3 (gallery): pending → running → done | partial | error | skipped
  gallery_state text not null default 'pending'
    check (gallery_state in ('pending', 'running', 'done', 'partial', 'error', 'skipped')),
  -- How many gallery photos have landed for this persona so far.
  gallery_done int not null default 0,
  -- How many gallery slots we've attempted, including failures. The
  -- picker uses this to advance through slots without retrying the
  -- same template forever; gallery_done counts only the successes.
  gallery_attempts int not null default 0,
  -- Persona id once Grok writes it (null until phase-1 finishes).
  persona_id text references public.chat_profiles (id) on delete set null,
  -- Snapshot of the persona row we need to display in the UI.
  display_name text,
  age int,
  city text,
  occupation text,
  avatar_url text,
  real_avatar_url text,
  -- Last error per phase; cleared on the next successful pass.
  profile_error text,
  photo_error text,
  gallery_error text,
  warning text,
  -- Set when a tick claims this row, so a crashed tick can be detected
  -- and retried by the next tick (stuck > 5 min → reset to pending).
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (batch_id, idx)
);

create index if not exists chat_persona_batch_items_progress_idx
  on public.chat_persona_batch_items (batch_id, idx);

-- Safety net for environments that applied an earlier draft of this
-- migration before `gallery_attempts` was added. Without it, the
-- worker fails to write the column and gallery items stay 'running'
-- forever. `if not exists` makes this a no-op for fresh databases.
alter table public.chat_persona_batch_items
  add column if not exists gallery_attempts int not null default 0;

comment on table public.chat_persona_batch_items is
  'Per-persona progress within a chat_persona_batches job. Worker picks the lowest-idx item with any pending phase and processes ONE unit (profile, avatar, or one gallery photo) per /batch/tick invocation.';

alter table public.chat_persona_batches enable row level security;
alter table public.chat_persona_batch_items enable row level security;

drop policy if exists "chat_persona_batches_select_own" on public.chat_persona_batches;
create policy "chat_persona_batches_select_own"
  on public.chat_persona_batches for select to authenticated
  using (owner_user_id = (select auth.uid()));

drop policy if exists "chat_persona_batch_items_select_own" on public.chat_persona_batch_items;
create policy "chat_persona_batch_items_select_own"
  on public.chat_persona_batch_items for select to authenticated
  using (
    exists (
      select 1 from public.chat_persona_batches b
      where b.id = chat_persona_batch_items.batch_id
        and b.owner_user_id = (select auth.uid())
    )
  );

-- All writes happen via the service-role worker; no client-side write
-- policies are required.
