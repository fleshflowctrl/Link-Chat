-- Discovery feed preferences (personalized grid ordering), synced across devices.

alter table public.user_profiles
  add column if not exists discovery_prefs jsonb not null default '{}'::jsonb;

comment on column public.user_profiles.discovery_prefs is
  'Feed personalization: connectWith, ageMin/Max, chatEnergy, interestPicks, datingIntent (v1 JSON).';
