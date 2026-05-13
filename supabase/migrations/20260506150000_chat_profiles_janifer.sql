-- AI persona Janifer; images live in Next.js `public/profiles/janifer/` (same-origin paths).

update public.chat_profiles
set home_sort = home_sort + 1
where home_sort between 2 and 6
  and not exists (select 1 from public.chat_profiles where id = 'janifer');

insert into public.chat_profiles (
  id, display_name, avatar_url, verified, online_now, is_ai, bio, filter_tags,
  last_message_preview, last_message_at,
  age, distance_km, gallery_urls, interests, looking_for,
  last_active_label, status_variant, status_label, joined_at, home_sort, city
) values (
  'janifer',
  'Janifer',
  '/profiles/janifer/janifer-01.png',
  true,
  false,
  true,
  $bio$Creatief, nieuwsgierig en licht chaotisch in een leuke zin. Ik hou van goede koffie, indie playlists en date-ideeën die niet uit een brochure komen. Geen drama — wel chemie.$bio$,
  array['links', 'active']::text[],
  'Zeg gerust hallo 👋',
  now() - interval '1 hour',
  24,
  3,
  array[
    '/profiles/janifer/janifer-01.png',
    '/profiles/janifer/janifer-02.png',
    '/profiles/janifer/janifer-03.png',
    '/profiles/janifer/janifer-04.png',
    '/profiles/janifer/janifer-05.png'
  ]::text[],
  '[
    {"label":"Muziek","icon":"listener"},
    {"label":"Speels","icon":"playful"},
    {"label":"Warm gezelschap","icon":"warm"},
    {"label":"Romantisch","icon":"romantic"}
  ]'::jsonb,
  'Iemand om mee te lachen en echt mee te praten',
  'Vandaag actief',
  'new',
  'Nieuw',
  now() - interval '3 hours',
  2,
  'Amsterdam'
)
on conflict (id) do update set
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  verified = excluded.verified,
  online_now = excluded.online_now,
  is_ai = excluded.is_ai,
  bio = excluded.bio,
  filter_tags = excluded.filter_tags,
  last_message_preview = excluded.last_message_preview,
  last_message_at = excluded.last_message_at,
  age = excluded.age,
  distance_km = excluded.distance_km,
  gallery_urls = excluded.gallery_urls,
  interests = excluded.interests,
  looking_for = excluded.looking_for,
  last_active_label = excluded.last_active_label,
  status_variant = excluded.status_variant,
  status_label = excluded.status_label,
  joined_at = excluded.joined_at,
  home_sort = excluded.home_sort,
  city = excluded.city;
