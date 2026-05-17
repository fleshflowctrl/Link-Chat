import type { SupabaseClient } from "@supabase/supabase-js";

import { processDuePendingReplies } from "@/lib/ai/pending-replies";
import { sleep } from "@/lib/ai/reply-pacing";
import type { ChatProfileRow } from "@/lib/chat/map-rows";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { scheduleAfterResponse } from "@/lib/vercel/schedule-after-response";

/** Stay under route maxDuration (120s) so waitUntil can finish short delays. */
const WAIT_UNTIL_BUDGET_MS = 110_000;

/**
 * After an async reply is queued, deliver it server-side when scheduled_at
 * arrives — even if the user closed the app. Long delays (>~2 min) still rely
 * on /api/cron/chat-pending-replies; this covers the common short/medium pauses.
 */
export function schedulePendingReplyDelivery(args: {
  ownerUserId: string;
  peerId: string;
  profile: ChatProfileRow;
  scheduledAtIso: string;
}): void {
  const service = getServiceSupabase();
  if (!service) return;

  void scheduleAfterResponse(async () => {
    await deliverWhenDue(service, args);
  });
}

async function deliverWhenDue(
  supabase: SupabaseClient,
  args: {
    ownerUserId: string;
    peerId: string;
    profile: ChatProfileRow;
    scheduledAtIso: string;
  },
): Promise<void> {
  const targetMs = new Date(args.scheduledAtIso).getTime();
  if (Number.isNaN(targetMs)) return;

  const deadline = Date.now() + WAIT_UNTIL_BUDGET_MS;

  while (Date.now() < deadline) {
    const wait = targetMs - Date.now();
    if (wait > 500) {
      await sleep(Math.min(wait, deadline - Date.now()));
      continue;
    }
    await processDuePendingReplies(supabase, {
      ownerUserId: args.ownerUserId,
      peerId: args.peerId,
      profile: args.profile,
    });
    return;
  }
}
