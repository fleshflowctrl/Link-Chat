-- Tracks which scene template was used for each generated persona
-- photo so the picker can spread future generations across the
-- least-used templates and never reuse a template inside one
-- persona's own photoset.
--
-- Picker logic (see lib/images/scene-templates.ts → pickFreshSceneTemplate):
--   1. For a given (persona_id, slot), exclude every template_id that
--      already appears in this table for that persona — regardless of
--      slot. (Avatars and gallery photos for one persona should never
--      share a scene template.)
--   2. Among the remaining candidates, pick the one with the smallest
--      global usage count across the whole table. Ties broken by a
--      stable hash on (persona_id, slot, attempt, template_id).
--   3. After a successful upload the caller writes a row here.
--
-- This is best-effort uniqueness — there is no hard constraint that
-- forces the worker to record a row, so if generation succeeds but
-- the row write fails the picker simply won't know that template was
-- already used. That's acceptable: the failure mode degrades to the
-- old behaviour, not to data corruption.

create table if not exists public.chat_persona_photo_templates (
  id bigserial primary key,
  persona_id text not null references public.chat_profiles (id) on delete cascade,
  slot text not null check (slot in ('avatar', 'gallery')),
  template_id text not null,
  template_scene text,
  used_at timestamptz not null default now()
);

create index if not exists chat_persona_photo_templates_persona_idx
  on public.chat_persona_photo_templates (persona_id);

create index if not exists chat_persona_photo_templates_template_idx
  on public.chat_persona_photo_templates (template_id);

-- Composite lookup the picker hits most often.
create index if not exists chat_persona_photo_templates_persona_slot_idx
  on public.chat_persona_photo_templates (persona_id, slot);

alter table public.chat_persona_photo_templates enable row level security;

-- RLS: only the service role talks to this table. The picker runs
-- inside server-only API routes (admin batch worker, persona-ops
-- helpers) and uses the service-role client. Mirror that — no policy
-- for anon/authenticated.
drop policy if exists chat_persona_photo_templates_service_role_all
  on public.chat_persona_photo_templates;
create policy chat_persona_photo_templates_service_role_all
  on public.chat_persona_photo_templates
  as permissive
  for all
  to service_role
  using (true)
  with check (true);
