-- Per-persona photo style descriptor. Used by the image-generation
-- pipeline to keep generated photos visually consistent for each
-- persona (same hair, build, vibe across multiple photos in the same
-- thread).
--
-- Schema (all keys optional):
--   {
--     "appearance": "lange donkere haren, bruine ogen, sproetjes",
--     "build": "slank, gemiddelde lengte",
--     "style": "casual, soft girl aesthetic, denim en oversized truien",
--     "vibe": "dromerig, een beetje verlegen",
--     "seed": 1234567890       -- stable randomness anchor
--   }
--
-- The image generator concatenates these into the prompt alongside the
-- per-message "scene" Grok decides to send. Missing keys fall back to
-- generic defaults so legacy personas still get plausible photos.

alter table public.chat_profiles
  add column if not exists photo_style jsonb;

comment on column public.chat_profiles.photo_style is
  'Per-persona photo style anchor for image generation: appearance, build, style, vibe, and a stable seed. Powers visual consistency across multiple AI-generated photos in the same thread.';

-- Extend chat_pending_replies.kind so the AI peer can also queue an
-- outgoing photo via the same delayed-delivery pipeline. The previous
-- foundation migration declared the CHECK constraint on insert; we
-- replace it here with the augmented value set.
alter table public.chat_pending_replies
  drop constraint if exists chat_pending_replies_kind_check;

alter table public.chat_pending_replies
  add constraint chat_pending_replies_kind_check
  check (kind in ('reply', 'spontaneous', 'winback', 'pre_ack', 'chunk', 'photo'));
