-- AI chat turn-log metrics: lightweight signals so we can spot regressions
-- in tone (e.g. "v6 stelt nu 91% vragen — te veel") without expensive analysis.
-- All columns nullable so existing rows stay valid; the route fills them per turn.

alter table public.ai_chat_turn_logs
  add column if not exists turn_index int,
  add column if not exists user_silence_ms bigint,
  add column if not exists output_chars int,
  add column if not exists had_question_mark boolean,
  add column if not exists had_emoji boolean,
  add column if not exists revised boolean;

comment on column public.ai_chat_turn_logs.turn_index is
  'How many AI-side messages preceded this one in this thread (0 = first reply).';
comment on column public.ai_chat_turn_logs.user_silence_ms is
  'Milliseconds between the user previous message and this user message (null on first turn).';
comment on column public.ai_chat_turn_logs.output_chars is
  'Length of the assistant reply after post-processing.';
comment on column public.ai_chat_turn_logs.had_question_mark is
  'Whether the assistant reply ends in a question mark.';
comment on column public.ai_chat_turn_logs.had_emoji is
  'Whether the assistant reply contains at least one emoji.';
comment on column public.ai_chat_turn_logs.revised is
  'True when the optional draft -> revise pass actually rewrote the reply.';
