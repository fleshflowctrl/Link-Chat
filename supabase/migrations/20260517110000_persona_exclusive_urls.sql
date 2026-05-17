-- Add exclusive_urls column to chat_profiles so that generated nude/exclusive
-- photos can be published separately from the regular gallery_urls.
-- This allows the admin to curate a specific set of photos as "Exclusive Content"
-- that users can unlock/view on the public exclusive content page.

alter table public.chat_profiles
  add column if not exists exclusive_urls text[] not null default '{}';

-- Optional: index for faster lookups when listing personas with exclusive content
create index if not exists chat_profiles_exclusive_urls_gin
  on public.chat_profiles using gin (exclusive_urls);
