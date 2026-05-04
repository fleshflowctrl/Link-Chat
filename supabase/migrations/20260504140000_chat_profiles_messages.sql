-- Whisper: AI chat personas + messages (run in Supabase SQL Editor or `supabase db push`).
-- Server routes use SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). Anon may SELECT chat_profiles only.

create table if not exists public.chat_profiles (
  id text primary key,
  display_name text not null,
  avatar_url text not null,
  verified boolean not null default false,
  online_now boolean not null default false,
  is_ai boolean not null default true,
  bio text not null default '',
  filter_tags text[] not null default '{}',
  last_message_preview text,
  last_message_at timestamptz
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  peer_id text not null references public.chat_profiles (id) on delete cascade,
  sender text not null check (sender in ('me', 'peer')),
  kind text not null default 'text' check (kind in ('text', 'image')),
  body text,
  image_url text,
  reaction_emoji text,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_peer_created_idx
  on public.chat_messages (peer_id, created_at);

alter table public.chat_profiles enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "chat_profiles_select_all" on public.chat_profiles;
create policy "chat_profiles_select_all"
  on public.chat_profiles for select
  to anon, authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policies for anon/authenticated on chat_messages:
-- only the service role (used from Next.js API routes) can write.

insert into public.chat_profiles (
  id, display_name, avatar_url, verified, online_now, is_ai, bio, filter_tags,
  last_message_preview, last_message_at
) values
(
  'maya',
  'Maya',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80&auto=format&fit=crop',
  true,
  true,
  true,
  'Into good coffee, road trips and warm conversation. You are Maya on a dating app — short, natural replies; playful but sincere; never mention being an AI or a language model.',
  array['links', 'active', 'replies', 'online']::text[],
  'Yes! Let''s plan it this weekend?',
  now() - interval '5 minutes'
),
(
  'elena',
  'Elena',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&q=80&auto=format&fit=crop',
  false,
  true,
  true,
  'You are Elena: curious, kind, a little flirty. Short messages. Dating app context. Never say you are an AI.',
  array['links', 'active', 'replies', 'online']::text[],
  'You seem fun 😊',
  now() - interval '1 day'
),
(
  'sophie',
  'Sophie',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80&auto=format&fit=crop',
  false,
  true,
  true,
  'You are Sophie: warm and easygoing. Brief replies. Dating chat. Never mention being an AI.',
  array['links', 'online']::text[],
  'Thanks for the chat!',
  now() - interval '1 day'
),
(
  'julia',
  'Julia',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&q=80&auto=format&fit=crop',
  false,
  false,
  true,
  'You are Julia: thoughtful and a bit reserved. Short replies. Dating app. Never mention being an AI.',
  array['more']::text[],
  'It was nice talking to you',
  now() - interval '2 days'
),
(
  'nina',
  'Nina',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80&auto=format&fit=crop',
  false,
  false,
  true,
  'You are Nina: friendly and upbeat. Short texts. Dating app. Never mention being an AI.',
  array['more']::text[],
  'Hey, how''s your day?',
  now() - interval '2 days'
)
on conflict (id) do update set
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  verified = excluded.verified,
  online_now = excluded.online_now,
  bio = excluded.bio,
  filter_tags = excluded.filter_tags;

-- Seed Maya thread (optional re-run: delete from chat_messages where peer_id = 'maya' first)
insert into public.chat_messages (peer_id, sender, kind, body, created_at)
select * from (values
  ('maya'::text, 'peer'::text, 'text'::text, 'Hey! Where are you from?'::text, now() - interval '35 minutes'),
  ('maya', 'me', 'text', 'Hey! I''m from Toronto 🇨🇦 What about you?', now() - interval '34 minutes'),
  ('maya', 'peer', 'text', 'Nice! I''m from Vancouver 😊 How''s the weather there?', now() - interval '33 minutes'),
  ('maya', 'me', 'text', 'It''s been sunny and warm ☀️ Perfect for coffee shop hopping!', now() - interval '32 minutes'),
  ('maya', 'peer', 'text', 'That sounds amazing. Any favorite spots?', now() - interval '31 minutes'),
  ('maya', 'me', 'text', 'There''s this tiny place downtown with the best lattes ☕ I''ll send you a pic!', now() - interval '28 minutes'),
  ('maya', 'peer', 'text', 'Looks lovely! 😍 We should check it out sometime.', now() - interval '27 minutes'),
  ('maya', 'me', 'text', 'Yes! Let''s plan it this weekend?', now() - interval '26 minutes')
) as v(peer_id, sender, kind, body, created_at)
where not exists (
  select 1 from public.chat_messages m where m.peer_id = 'maya' limit 1
);

insert into public.chat_messages (peer_id, sender, kind, body, created_at)
select * from (values
  ('elena'::text, 'peer'::text, 'text'::text, 'Hey — it''s Elena. Say hi anytime 👋'::text, now() - interval '2 hours')
) as v(peer_id, sender, kind, body, created_at)
where not exists (select 1 from public.chat_messages m where m.peer_id = 'elena' limit 1);

insert into public.chat_messages (peer_id, sender, kind, body, created_at)
select * from (values
  ('sophie'::text, 'peer'::text, 'text'::text, 'Hey — it''s Sophie. Say hi anytime 👋'::text, now() - interval '3 hours')
) as v(peer_id, sender, kind, body, created_at)
where not exists (select 1 from public.chat_messages m where m.peer_id = 'sophie' limit 1);

insert into public.chat_messages (peer_id, sender, kind, body, created_at)
select * from (values
  ('julia'::text, 'peer'::text, 'text'::text, 'Hey — it''s Julia. Say hi anytime 👋'::text, now() - interval '4 hours')
) as v(peer_id, sender, kind, body, created_at)
where not exists (select 1 from public.chat_messages m where m.peer_id = 'julia' limit 1);

insert into public.chat_messages (peer_id, sender, kind, body, created_at)
select * from (values
  ('nina'::text, 'peer'::text, 'text'::text, 'Hey — it''s Nina. Say hi anytime 👋'::text, now() - interval '5 hours')
) as v(peer_id, sender, kind, body, created_at)
where not exists (select 1 from public.chat_messages m where m.peer_id = 'nina' limit 1);
