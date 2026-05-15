/**
 * Lightweight DB-health probe for the admin panel.
 *
 * The admin form depends on several recent migrations being applied to
 * the production Supabase database (persona-depth, chat-realism, photo-
 * style, pending-replies). When the operator forgets to run one we want
 * to fail FAST with a clear "apply this migration" banner — not bury the
 * cause inside a generic 500 page.
 *
 * The probe issues a single low-cost SELECT for each "canary" column
 * we need; missing columns surface as Postgres error code 42703 with a
 * predictable message we can match cheaply.
 *
 * Result shape is intentionally serialisable so server components can
 * forward it straight to a client banner component without re-shaping.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type MigrationCheck = {
  /** Filename of the migration that adds the canary column. */
  file: string;
  /** Human-readable summary used in the banner. */
  label: string;
  /** True when the canary column resolves; false when it doesn't. */
  applied: boolean;
};

export type DbHealthReport = {
  /** All canary checks resolved. */
  ok: boolean;
  /** Each migration that we probe, with its applied flag. */
  checks: MigrationCheck[];
  /** When ok=false, list of files the operator still has to apply. */
  missing: MigrationCheck[];
};

const CANARIES: Array<{ file: string; label: string; table: string; column: string }> = [
  {
    file: "20260514220000_chat_profiles_chat_style.sql",
    label: "Chat-style metadata (chat_profiles.chat_style)",
    table: "chat_profiles",
    column: "chat_style",
  },
  {
    file: "20260514230000_chat_pending_replies.sql",
    label: "Pending replies queue (chat_pending_replies tabel)",
    table: "chat_pending_replies",
    column: "id",
  },
  {
    file: "20260515110000_chat_realism_foundation.sql",
    label: "Realism: peer_read_at + structured_facts",
    table: "chat_messages",
    column: "peer_read_at",
  },
  {
    file: "20260515120000_chat_profiles_photo_style.sql",
    label: "Photo-style anchor (chat_profiles.photo_style)",
    table: "chat_profiles",
    column: "photo_style",
  },
  {
    file: "20260515140000_chat_profiles_persona_depth.sql",
    label: "Persona-diepte (occupation/backstory/persona_meta/is_archived)",
    table: "chat_profiles",
    column: "occupation",
  },
];

/** Return true when an error looks like "column ... does not exist" or
 * "relation ... does not exist". Postgres uses 42703 / 42P01. Supabase
 * surfaces these as `{ code, message }` on the JS client. */
function isMissingSchemaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  if (e.code === "42703" || e.code === "42P01") return true;
  const msg = e.message ?? "";
  return /does not exist/i.test(msg);
}

export async function probeDbHealth(supabase: SupabaseClient): Promise<DbHealthReport> {
  const checks: MigrationCheck[] = [];

  await Promise.all(
    CANARIES.map(async (c) => {
      try {
        const { error } = await supabase.from(c.table).select(c.column).limit(1);
        const missing = !!error && isMissingSchemaError(error);
        checks.push({ file: c.file, label: c.label, applied: !missing });
      } catch {
        checks.push({ file: c.file, label: c.label, applied: false });
      }
    }),
  );

  // Preserve the canary order (Promise.all resolves out-of-order).
  checks.sort(
    (a, b) =>
      CANARIES.findIndex((c) => c.file === a.file) -
      CANARIES.findIndex((c) => c.file === b.file),
  );

  const missing = checks.filter((c) => !c.applied);
  return { ok: missing.length === 0, checks, missing };
}
