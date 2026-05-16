/**
 * Helpers for hard-deleting a persona — used by both the per-id DELETE
 * route and the bulk-delete route.
 *
 * Cascade behaviour:
 *   - chat_messages, chat_ai_thread_memory, chat_pending_replies,
 *     ai_chat_turn_logs all FK -> chat_profiles ON DELETE CASCADE, so
 *     the row delete handles those automatically.
 *   - Storage objects don't cascade — we list-and-remove per persona id
 *     across two folder conventions:
 *        chat-images/admin-personas/{personaId}/*       (avatar + gallery)
 *        chat-images/{ownerId}/peer-photos/{personaId}/* (chat uploads)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export async function purgePersonaStorage(
  service: SupabaseClient,
  personaId: string,
): Promise<{ removed: number; errors: string[] }> {
  const errors: string[] = [];
  let removed = 0;

  // 1. admin-personas/{id}/* — avatar + gallery photos uploaded for the persona itself.
  try {
    const { data: adminFiles, error: listErr } = await service.storage
      .from("chat-images")
      .list(`admin-personas/${personaId}`, { limit: 1000 });
    if (listErr) {
      errors.push(`list admin-personas: ${listErr.message}`);
    } else if (adminFiles && adminFiles.length > 0) {
      const paths = adminFiles
        .filter((f) => !!f.name && !f.name.endsWith("/"))
        .map((f) => `admin-personas/${personaId}/${f.name}`);
      if (paths.length > 0) {
        const { error: rmErr } = await service.storage.from("chat-images").remove(paths);
        if (rmErr) errors.push(`remove admin-personas: ${rmErr.message}`);
        else removed += paths.length;
      }
    }
  } catch (e) {
    errors.push(`admin-personas threw: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 2. {ownerId}/peer-photos/{personaId}/* — chat-photo uploads scoped per
  // owner. We can't list across owners cheaply; we discover owners via a
  // chat_messages query first, then iterate.
  try {
    const { data: ownerRows } = await service
      .from("chat_messages")
      .select("owner_user_id")
      .eq("peer_id", personaId)
      .eq("kind", "image")
      .limit(1000);
    const ownerSet = new Set<string>();
    const owners: string[] = [];
    for (const r of (ownerRows ?? []) as Array<{ owner_user_id?: string | null }>) {
      if (r.owner_user_id && !ownerSet.has(r.owner_user_id)) {
        ownerSet.add(r.owner_user_id);
        owners.push(r.owner_user_id);
      }
    }
    for (const ownerId of owners) {
      const folder = `${ownerId}/peer-photos/${personaId}`;
      const { data: peerFiles, error: listErr } = await service.storage
        .from("chat-images")
        .list(folder, { limit: 1000 });
      if (listErr) {
        errors.push(`list ${folder}: ${listErr.message}`);
        continue;
      }
      if (!peerFiles || peerFiles.length === 0) continue;
      const paths = peerFiles
        .filter((f) => !!f.name && !f.name.endsWith("/"))
        .map((f) => `${folder}/${f.name}`);
      if (paths.length === 0) continue;
      const { error: rmErr } = await service.storage.from("chat-images").remove(paths);
      if (rmErr) errors.push(`remove ${folder}: ${rmErr.message}`);
      else removed += paths.length;
    }
  } catch (e) {
    errors.push(`peer-photos threw: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { removed, errors };
}
