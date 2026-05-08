-- Funnel step-2 intent tags on AI personas + anon read of AI catalog rows for onboarding.

alter table public.chat_profiles
  add column if not exists funnel_intent_ids text[] not null default '{}';

create index if not exists chat_profiles_funnel_intent_ids_gin_idx
  on public.chat_profiles using gin (funnel_intent_ids);

-- Allow anonymous funnel to load AI personas only (real user rows stay auth-only).
drop policy if exists "chat_profiles_select_anon_ai" on public.chat_profiles;
create policy "chat_profiles_select_anon_ai"
  on public.chat_profiles for select to anon
  using (is_ai = true);

update public.chat_profiles set funnel_intent_ids = array['meaningful','chatting']::text[] where id = 'maya';
update public.chat_profiles set funnel_intent_ids = array['casual','meaningful','chatting']::text[] where id = 'elena';
update public.chat_profiles set funnel_intent_ids = array['friends','chatting']::text[] where id = 'sophie';
update public.chat_profiles set funnel_intent_ids = array['meaningful','chatting']::text[] where id = 'julia';
update public.chat_profiles set funnel_intent_ids = array['chatting','casual']::text[] where id = 'nina';
update public.chat_profiles set funnel_intent_ids = array['friends','casual','chatting']::text[] where id = 'marcus';
update public.chat_profiles set funnel_intent_ids = array['meaningful','chatting']::text[] where id = 'thomas';
update public.chat_profiles set funnel_intent_ids = array['meaningful','casual']::text[] where id = 'oliver';
update public.chat_profiles set funnel_intent_ids = array['meaningful','friends','chatting']::text[] where id = 'victoria';
update public.chat_profiles set funnel_intent_ids = array['meaningful','chatting']::text[] where id = 'clara';
update public.chat_profiles set funnel_intent_ids = array['meaningful','friends','chatting']::text[] where id = 'janifer';
