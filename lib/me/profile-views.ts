/**
 * Per-user "seen on discover" + "opened a chat with" history.
 *
 * Backed by `public.user_profile_views`. Used by the discover feed picker so
 * a profile you just swiped past lands at the back of the next pack and a
 * profile you already opened a chat with disappears from /discover entirely
 * (you can still find them in /messages).
 *
 * All helpers are best-effort: if Supabase is unreachable or the table is
 * missing (e.g. fresh DB without the migration applied) they return empty
 * data instead of crashing the feed.
 */

import { createClient } from "@/utils/supabase/server";

/** Demote any profile seen in the last N days (others count as "fresh again"). */
const DEMOTE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type ProfileViewHistory = {
  /** Profiles the user already opened a chat with — hide from discover. */
  excludeIds: Set<string>;
  /** Profiles the user saw recently — push to back of the pack. */
  demoteIds: Set<string>;
};

const EMPTY: ProfileViewHistory = {
  excludeIds: new Set(),
  demoteIds: new Set(),
};

/**
 * Load the user's discover history. Returns empty sets on error / for guests
 * so the feed never breaks because of a missing table.
 */
export async function loadProfileViewHistory(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<ProfileViewHistory> {
  try {
    const cutoffIso = new Date(Date.now() - DEMOTE_WINDOW_MS).toISOString();
    const { data, error } = await supabase
      .from("user_profile_views")
      .select("profile_id, opened_chat, last_seen_at")
      .eq("user_id", userId)
      .or(`opened_chat.eq.true,last_seen_at.gte.${cutoffIso}`);

    if (error || !data) return EMPTY;

    const excludeIds = new Set<string>();
    const demoteIds = new Set<string>();
    for (const row of data as Array<{
      profile_id: string | null;
      opened_chat: boolean | null;
      last_seen_at: string | null;
    }>) {
      if (!row.profile_id) continue;
      if (row.opened_chat) {
        excludeIds.add(row.profile_id);
      } else if (row.last_seen_at) {
        demoteIds.add(row.profile_id);
      }
    }
    return { excludeIds, demoteIds };
  } catch {
    return EMPTY;
  }
}

/** Bump `last_seen_at` for a profile the user just saw on discover. */
export async function recordProfileSeen(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  profileId: string,
): Promise<void> {
  if (!profileId) return;
  try {
    await supabase
      .from("user_profile_views")
      .upsert(
        {
          user_id: userId,
          profile_id: profileId,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,profile_id" },
      );
  } catch {
    /* best effort — never block the request on history writes */
  }
}

/**
 * Mark a profile as "opened chat" — once true it stays true even if the user
 * never replies, so the profile won't bubble back up in discover.
 */
export async function recordProfileChatOpened(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  profileId: string,
): Promise<void> {
  if (!profileId) return;
  try {
    const nowIso = new Date().toISOString();
    await supabase
      .from("user_profile_views")
      .upsert(
        {
          user_id: userId,
          profile_id: profileId,
          last_seen_at: nowIso,
          opened_chat: true,
          opened_chat_at: nowIso,
        },
        { onConflict: "user_id,profile_id" },
      );
  } catch {
    /* best effort */
  }
}
