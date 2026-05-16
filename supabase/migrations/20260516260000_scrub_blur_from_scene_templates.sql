-- Scrub blur / bokeh / depth-of-field tokens out of every existing
-- scene_templates row.
--
-- Why: the prompt-builder (lib/images/persona-photo-prompt.ts) and the
-- Grok intake (lib/admin/scene-template-generator.ts) now strip these
-- phrases at runtime, so newly-generated and newly-rendered photos are
-- already safe. This migration cleans up rows that were inserted
-- BEFORE the runtime scrubber landed — most importantly the in-code
-- seed templates that mentioned "out-of-focus" / "blurry-far" before
-- they were patched in 20260516.
--
-- We update each field independently. Each regex is run twice: once
-- to remove the token, once to compact whitespace/commas left behind.
-- This is intentionally a static text rewrite, not a full natural-
-- language fixup — if Grok wrote an entire sentence around the word
-- "bokeh" the result is grammatically a bit awkward, but the diffusion
-- model doesn't care and the operator can reject those rows manually
-- through the admin UI.

create or replace function public.scene_templates_strip_blur(s text)
returns text
language sql
immutable
as $$
  select trim(
    both ' ,;:.-'
    from regexp_replace(
      regexp_replace(
        regexp_replace(
          coalesce(s, ''),
          -- Phase 1: kill blur-related tokens.
          '\m(slightly\s+|completely\s+)?out[\s\-]of[\s\-]focus\M|\mblurry[\s\-]far\M|\mblurry\s+(background|foreground|subject|edges|vignette|distance|crowd|people)\M|\mblurred\s+(background|foreground|subject|edges|vignette|distance|crowd|people)\M|\mblurry\M|\mblurred\M|\mblur\M|\mdefocused\M|\mdefocus\M|\m(creamy\s+|simulated\s+|lens\s+|natural\s+)?bokeh\M|\mshallow\s+depth\s+of\s+field\M|\mshallow\s+dof\M|\m(iphone\s+)?portrait\s+mode\M|\m(lens|motion|gaussian|camera\s+shake|subject\s+motion)\s+blur\M|\msoft\s+focus\M|\msoft\s+background\M|\mhazy\s+soft\s+edges\M',
          '',
          'gi'
        ),
        -- Phase 2: compact dangling ", ," and double whitespace.
        '\s*,\s*,+',
        ', ',
        'g'
      ),
      '\s{2,}',
      ' ',
      'g'
    )
  );
$$;

update public.scene_templates
   set scene     = public.scene_templates_strip_blur(scene),
       camera    = public.scene_templates_strip_blur(camera),
       backdrop  = public.scene_templates_strip_blur(backdrop),
       lighting  = public.scene_templates_strip_blur(lighting),
       capture   = public.scene_templates_strip_blur(capture),
       outfit    = public.scene_templates_strip_blur(outfit),
       pose      = public.scene_templates_strip_blur(pose),
       updated_at = now()
 where scene    ~* '\m(blur|blurry|blurred|bokeh|defocus|defocused|out[\s\-]of[\s\-]focus|shallow\s+(depth\s+of\s+field|dof)|portrait\s+mode|soft\s+focus|soft\s+background|hazy\s+soft\s+edges)\M'
    or camera   ~* '\m(blur|blurry|blurred|bokeh|defocus|defocused|out[\s\-]of[\s\-]focus|shallow\s+(depth\s+of\s+field|dof)|portrait\s+mode|soft\s+focus|soft\s+background|hazy\s+soft\s+edges)\M'
    or backdrop ~* '\m(blur|blurry|blurred|bokeh|defocus|defocused|out[\s\-]of[\s\-]focus|shallow\s+(depth\s+of\s+field|dof)|portrait\s+mode|soft\s+focus|soft\s+background|hazy\s+soft\s+edges)\M'
    or lighting ~* '\m(blur|blurry|blurred|bokeh|defocus|defocused|out[\s\-]of[\s\-]focus|shallow\s+(depth\s+of\s+field|dof)|portrait\s+mode|soft\s+focus|soft\s+background|hazy\s+soft\s+edges)\M'
    or capture  ~* '\m(blur|blurry|blurred|bokeh|defocus|defocused|out[\s\-]of[\s\-]focus|shallow\s+(depth\s+of\s+field|dof)|portrait\s+mode|soft\s+focus|soft\s+background|hazy\s+soft\s+edges)\M'
    or outfit   ~* '\m(blur|blurry|blurred|bokeh|defocus|defocused|out[\s\-]of[\s\-]focus|shallow\s+(depth\s+of\s+field|dof)|portrait\s+mode|soft\s+focus|soft\s+background|hazy\s+soft\s+edges)\M'
    or pose     ~* '\m(blur|blurry|blurred|bokeh|defocus|defocused|out[\s\-]of[\s\-]focus|shallow\s+(depth\s+of\s+field|dof)|portrait\s+mode|soft\s+focus|soft\s+background|hazy\s+soft\s+edges)\M';

-- The helper has no future use after this run — keep it around in case
-- the operator wants to re-scrub by hand later, no need to drop.

comment on function public.scene_templates_strip_blur(text) is
  'Strips blur/bokeh/depth-of-field tokens from a scene_templates string field. Used by migration 20260516260000 to scrub historical rows; safe to call ad-hoc afterwards.';
