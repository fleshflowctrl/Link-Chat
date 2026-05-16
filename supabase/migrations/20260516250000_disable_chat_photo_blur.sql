-- Disable the chat-photo blur/paywall feature.
--
-- Operator decided that no chat photos should be blurred anymore — not
-- even explicit ones. Code path that previously set blur_cost = 50 for
-- nude scenes has been removed; this migration clears any historical
-- rows so existing chats also display unblurred.
--
-- We keep the column and the chat_photo_unlocks table around so any
-- already-purchased unlocks remain valid records, and so we don't have
-- to invasively touch downstream readers (lib/chat/map-rows.ts treats
-- blur_cost = 0 as "no blur").

update public.chat_messages
   set blur_cost = 0
 where blur_cost is null or blur_cost <> 0;
