-- City label for discovery cards (replaces distance-only UX in the app).

alter table public.chat_profiles
  add column if not exists city text not null default 'Amsterdam';

update public.chat_profiles set city = 'Amsterdam' where id = 'maya';
update public.chat_profiles set city = 'Nijmegen' where id = 'elena';
update public.chat_profiles set city = 'Haarlem' where id = 'sophie';
update public.chat_profiles set city = 'Breda' where id = 'julia';
update public.chat_profiles set city = 'Tilburg' where id = 'nina';
update public.chat_profiles set city = 'Rotterdam' where id = 'marcus';
update public.chat_profiles set city = 'Utrecht' where id = 'thomas';
update public.chat_profiles set city = 'Den Haag' where id = 'oliver';
update public.chat_profiles set city = 'Eindhoven' where id = 'victoria';
update public.chat_profiles set city = 'Groningen' where id = 'clara';
