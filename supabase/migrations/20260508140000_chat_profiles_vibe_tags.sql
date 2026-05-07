-- Phase 1: funnel-aligned vibe tags on catalog personas (`chat_profiles.vibe_tags`).
-- Values must be subset of funnel step-3 ids (see `FUNNEL_VIBES` in `data/funnel.ts`).

alter table public.chat_profiles
  add column if not exists vibe_tags text[] not null default '{}';

create index if not exists chat_profiles_vibe_tags_gin_idx
  on public.chat_profiles using gin (vibe_tags);

-- Backfill: aligned with `data/profiles.ts` where the same id exists; sensible defaults otherwise.
update public.chat_profiles set vibe_tags = array['caring','romantic','playful','chill','coffee','travel']::text[] where id = 'maya';
update public.chat_profiles set vibe_tags = array['romantic','playful','caring']::text[] where id = 'elena';
update public.chat_profiles set vibe_tags = array['playful','caring','chill']::text[] where id = 'sophie';
update public.chat_profiles set vibe_tags = array['chill','romantic','caring']::text[] where id = 'julia';
update public.chat_profiles set vibe_tags = array['playful','caring','witty']::text[] where id = 'nina';

update public.chat_profiles set vibe_tags = array['gym','playful','romantic','witty','coffee','travel']::text[] where id = 'marcus';
update public.chat_profiles set vibe_tags = array['movies','romantic','playful','coffee']::text[] where id = 'thomas';
update public.chat_profiles set vibe_tags = array['romantic','caring','coffee','chill']::text[] where id = 'oliver';
update public.chat_profiles set vibe_tags = array['romantic','playful','travel','movies']::text[] where id = 'victoria';
update public.chat_profiles set vibe_tags = array['caring','romantic','coffee','chill']::text[] where id = 'clara';

update public.chat_profiles set vibe_tags = array['playful','romantic','caring','witty','chill']::text[] where id = 'janifer';
