-- Rich discovery fields for catalog (AI) personas. Real humans use user_profiles only.

alter table public.chat_profiles
  add column if not exists age smallint not null default 25;
alter table public.chat_profiles
  add column if not exists distance_km smallint not null default 4;
alter table public.chat_profiles
  add column if not exists gallery_urls text[] not null default '{}';
alter table public.chat_profiles
  add column if not exists interests jsonb not null default '[]'::jsonb;
alter table public.chat_profiles
  add column if not exists looking_for text not null default '';
alter table public.chat_profiles
  add column if not exists last_active_label text not null default 'Active today';
alter table public.chat_profiles
  add column if not exists status_variant text not null default 'active';
alter table public.chat_profiles
  add column if not exists status_label text not null default 'Active now';
alter table public.chat_profiles
  add column if not exists joined_at timestamptz;
alter table public.chat_profiles
  add column if not exists home_sort int not null default 100;

-- --- Catalog updates (home grid order: home_sort 1–6) ---

update public.chat_profiles set
  age = 26,
  distance_km = 2,
  looking_for = 'Meaningful connection',
  last_active_label = 'Active today',
  status_variant = 'active',
  status_label = 'Active now',
  home_sort = 1,
  joined_at = coalesce(joined_at, now() - interval '2 days'),
  gallery_urls = array[
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1200&q=80&auto=format&fit=crop'
  ],
  interests = '[
    {"label":"Caring","icon":"caring"},
    {"label":"Romantic","icon":"romantic"},
    {"label":"Playful","icon":"playful"},
    {"label":"Warm company","icon":"warm"},
    {"label":"Good listener","icon":"listener"}
  ]'::jsonb,
  bio = 'Into good coffee, road trips and meaningful conversations. Soft & warm — not here for games. Let''s vibe and see where it goes 🌿'
where id = 'maya';

update public.chat_profiles set
  age = 27,
  distance_km = 6,
  looking_for = 'Playful chats & real chemistry',
  last_active_label = 'Active today',
  status_variant = 'new',
  status_label = 'New',
  home_sort = 50,
  joined_at = coalesce(joined_at, now() - interval '6 hours'),
  gallery_urls = array[
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=1200&q=80&auto=format&fit=crop'
  ],
  interests = '[
    {"label":"Curious","icon":"listener"},
    {"label":"Playful","icon":"playful"},
    {"label":"Romantic","icon":"romantic"}
  ]'::jsonb,
  bio = 'Curious, kind, a little flirty. Here for good energy and conversations that actually go somewhere.'
where id = 'elena';

update public.chat_profiles set
  age = 25,
  distance_km = 4,
  looking_for = 'Good conversations',
  last_active_label = 'Just now',
  status_variant = 'new',
  status_label = 'New',
  home_sort = 50,
  joined_at = coalesce(joined_at, now() - interval '3 hours'),
  gallery_urls = array[
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1200&q=80&auto=format&fit=crop'
  ],
  interests = '[
    {"label":"New here","icon":"listener"},
    {"label":"Friendly","icon":"warm"}
  ]'::jsonb
where id = 'sophie';

update public.chat_profiles set
  age = 26,
  distance_km = 7,
  looking_for = 'Thoughtful conversation',
  last_active_label = 'Active today',
  status_variant = 'quiet',
  status_label = 'Quiet tonight',
  home_sort = 50,
  joined_at = coalesce(joined_at, now() - interval '18 hours'),
  gallery_urls = array[
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200&q=80&auto=format&fit=crop'
  ],
  interests = '[
    {"label":"Warm company","icon":"warm"},
    {"label":"Good listener","icon":"listener"}
  ]'::jsonb
where id = 'julia';

update public.chat_profiles set
  age = 24,
  distance_km = 9,
  looking_for = 'Light banter & laughs',
  last_active_label = 'Active today',
  status_variant = 'online',
  status_label = 'Online',
  home_sort = 50,
  joined_at = coalesce(joined_at, now() - interval '1 hour'),
  gallery_urls = array[
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1200&q=80&auto=format&fit=crop'
  ],
  interests = '[
    {"label":"Playful","icon":"playful"},
    {"label":"Warm company","icon":"warm"}
  ]'::jsonb
where id = 'nina';

insert into public.chat_profiles (
  id, display_name, avatar_url, verified, online_now, is_ai, bio, filter_tags,
  last_message_preview, last_message_at,
  age, distance_km, gallery_urls, interests, looking_for,
  last_active_label, status_variant, status_label, joined_at, home_sort
) values
(
  'marcus',
  'Marcus',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80&auto=format&fit=crop',
  false,
  false,
  true,
  'Engineer by day, runner by night. I love honest conversation, live music, and finding the best ramen in every city I visit.',
  array['links','active']::text[],
  'Say hi anytime 👋',
  now() - interval '4 hours',
  29, 5,
  array[
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80&auto=format&fit=crop'
  ],
  '[
    {"label":"Fitness","icon":"caring"},
    {"label":"Music","icon":"listener"},
    {"label":"Foodie","icon":"playful"},
    {"label":"Night owl","icon":"romantic"}
  ]'::jsonb,
  'Running partner & late-night talks',
  'Active today', 'replied', 'Replied recently',
  now() - interval '30 minutes',
  2
),
(
  'thomas',
  'Thomas',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80&auto=format&fit=crop',
  true,
  false,
  true,
  'Film school grad. Always down to debate endings, share recommendations, and find someone who reads the credits.',
  array['links']::text[],
  'Say hi anytime 👋',
  now() - interval '5 hours',
  27, 8,
  array[
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&q=80&auto=format&fit=crop'
  ],
  '[
    {"label":"Movies","icon":"listener"},
    {"label":"Storytelling","icon":"romantic"},
    {"label":"Playful","icon":"playful"},
    {"label":"Warm company","icon":"warm"}
  ]'::jsonb,
  'Cinema dates & deep dives',
  'Active today', 'new', 'New',
  now() - interval '12 hours',
  3
),
(
  'oliver',
  'Oliver',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80&auto=format&fit=crop',
  false,
  false,
  true,
  'Home cook, weekend cyclist, and collector of cookbooks I actually use. Looking for someone who enjoys farmers markets and lazy Sundays.',
  array['more']::text[],
  'Say hi anytime 👋',
  now() - interval '6 hours',
  38, 12,
  array[
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=1200&q=80&auto=format&fit=crop'
  ],
  '[
    {"label":"Cooking","icon":"warm"},
    {"label":"Romantic","icon":"romantic"},
    {"label":"Caring","icon":"caring"},
    {"label":"Good listener","icon":"listener"}
  ]'::jsonb,
  'Slow mornings & good food',
  'Active today', 'popular', 'Popular',
  now() - interval '1 day',
  4
),
(
  'victoria',
  'Victoria',
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&q=80&auto=format&fit=crop',
  true,
  false,
  true,
  'Curator-in-training. I love gallery openings, vintage shops, and long walks with coffee in hand. Let''s swap playlists.',
  array['links','more']::text[],
  'Say hi anytime 👋',
  now() - interval '7 hours',
  29, 3,
  array[
    'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=1200&q=80&auto=format&fit=crop'
  ],
  '[
    {"label":"Art","icon":"romantic"},
    {"label":"Music","icon":"listener"},
    {"label":"Playful","icon":"playful"},
    {"label":"Warm company","icon":"warm"}
  ]'::jsonb,
  'Creative soul & museum dates',
  'Active today', 'quiet', 'Quiet tonight',
  now() - interval '2 days',
  5
),
(
  'clara',
  'Clara',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&q=80&auto=format&fit=crop',
  false,
  true,
  true,
  'Reader, tea drinker, and amateur baker. I value kindness, curiosity, and people who ask good follow-up questions.',
  array['links','online','replies']::text[],
  'Say hi anytime 👋',
  now() - interval '8 hours',
  26, 1,
  array[
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=1200&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1481627834876-b9933fe8c685?w=1200&q=80&auto=format&fit=crop'
  ],
  '[
    {"label":"Books","icon":"listener"},
    {"label":"Caring","icon":"caring"},
    {"label":"Romantic","icon":"romantic"},
    {"label":"Good listener","icon":"listener"}
  ]'::jsonb,
  'Thoughtful conversation',
  'Active today', 'online', 'Online',
  now() - interval '45 minutes',
  6
)
on conflict (id) do update set
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  verified = excluded.verified,
  online_now = excluded.online_now,
  is_ai = excluded.is_ai,
  bio = excluded.bio,
  filter_tags = excluded.filter_tags,
  age = excluded.age,
  distance_km = excluded.distance_km,
  gallery_urls = excluded.gallery_urls,
  interests = excluded.interests,
  looking_for = excluded.looking_for,
  last_active_label = excluded.last_active_label,
  status_variant = excluded.status_variant,
  status_label = excluded.status_label,
  joined_at = excluded.joined_at,
  home_sort = excluded.home_sort;
