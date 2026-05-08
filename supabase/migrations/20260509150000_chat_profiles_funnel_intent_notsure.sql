-- Personas open to undecided users: Step-6 intent bonus when funnel picks "not sure yet".

update public.chat_profiles
set funnel_intent_ids = funnel_intent_ids || array['notsure']::text[]
where id in ('elena', 'sophie', 'nina', 'marcus', 'victoria', 'janifer')
  and not ('notsure' = any (funnel_intent_ids));
