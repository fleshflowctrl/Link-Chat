-- Raise the per-batch persona cap from 20 → 100.
--
-- The application-level MAX_BATCH (server route + admin UI) was bumped
-- to 100 to let operators seed a production-sized feed in one go, but
-- the original CHECK constraint on chat_persona_batches.total still
-- maxed out at 20 — so any /api/admin/personas/batch/start call with
-- count > 20 hit a constraint violation before the row was even
-- written. Drop and re-add with the new upper bound.

alter table public.chat_persona_batches
  drop constraint if exists chat_persona_batches_total_check;

alter table public.chat_persona_batches
  add constraint chat_persona_batches_total_check
  check (total > 0 and total <= 100);
