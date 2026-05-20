-- v2: follow-up when user opens chat on bot's last message but doesn't reply in 5 min.

alter table public.chat_pending_replies
  drop constraint if exists chat_pending_replies_kind_check;

alter table public.chat_pending_replies
  add constraint chat_pending_replies_kind_check
  check (
    kind in (
      'reply',
      'spontaneous',
      'winback',
      'pre_ack',
      'chunk',
      'photo',
      'v2_open_followup'
    )
  );

comment on column public.chat_pending_replies.kind is
  'reply: delayed AI reply. spontaneous/winback: re-engagement. v2_open_followup: v2 only — 5min after opening chat on bot last bubble without user reply. chunk/photo: multi-bubble/photo pipeline.';
