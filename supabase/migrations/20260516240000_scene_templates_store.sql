-- Scene templates moved to DB so the operator can:
--   1. Have Grok generate hundreds/thousands more templates without
--      the dev redeploying lib/images/scene-templates.ts.
--   2. Reject bad templates with a reason; that reason becomes
--      negative feedback in the next Grok generation prompt so the
--      model stops repeating the same mistakes.
--
-- The in-code SCENE_TEMPLATES array still exists as a fallback for
-- when the DB is empty or unreachable — see lib/admin/scene-templates-store.ts.
-- Idea: the picker (pickFreshSceneTemplate) tries DB first, falls back
-- to the in-code list if loading fails. This way nothing breaks if the
-- migration hasn't been applied yet on a given environment.

create table if not exists public.scene_templates (
  id uuid primary key default gen_random_uuid(),
  -- The seven prompt fields, mirroring lib/images/scene-templates.ts SceneTemplate.
  scene text not null,
  camera text not null,
  backdrop text not null,
  lighting text not null,
  capture text not null,
  outfit text not null,
  pose text not null,
  -- Slot. Matches SceneTemplate["kind"].
  kind text not null check (kind in ('avatar', 'gallery', 'mixed')),
  -- Curation metadata. Filled by the Grok generator (or 'seed' for the
  -- in-code templates if the operator chooses to seed them).
  category text,                -- e.g. 'cafe', 'beach', 'home', 'mirror-selfie', 'friend-snapshot'
  age_tier_hint text check (
    age_tier_hint is null
    or age_tier_hint in ('young', 'mid', 'old', 'any')
  ),
  source text not null default 'seed',         -- 'seed' | 'grok-batch-{uuid}'
  -- Stable hash, matches lib/images/scene-templates.ts templateId().
  -- Used as the link key with chat_persona_photo_templates so usage
  -- tracking still works after a template moves from in-code to DB.
  template_id text not null,
  -- Rejection state. is_active false means the picker skips it.
  is_active boolean not null default true,
  rejected_at timestamptz,
  rejection_reason text,
  rejection_tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One template per stable hash. If Grok ever spits out a duplicate
-- we catch it at insert time and skip.
create unique index if not exists scene_templates_template_id_uniq
  on public.scene_templates (template_id);

-- Picker hot path: load active templates for a slot.
create index if not exists scene_templates_kind_active_idx
  on public.scene_templates (kind, is_active);

-- Admin browse: filter by category among active templates.
create index if not exists scene_templates_category_active_idx
  on public.scene_templates (category)
  where is_active = true;

-- Browse pagination: newest first.
create index if not exists scene_templates_created_at_idx
  on public.scene_templates (created_at desc);

-- Touch updated_at on any row mutation.
create or replace function public.scene_templates_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists scene_templates_touch on public.scene_templates;
create trigger scene_templates_touch
  before update on public.scene_templates
  for each row execute function public.scene_templates_touch_updated_at();

alter table public.scene_templates enable row level security;

-- RLS: only the service role hits this table. The picker runs inside
-- server-only API routes (admin batch worker, persona-ops helpers,
-- admin scene-template generator) and uses the service-role client.
drop policy if exists scene_templates_service_role_all
  on public.scene_templates;
create policy scene_templates_service_role_all
  on public.scene_templates
  as permissive
  for all
  to service_role
  using (true)
  with check (true);
