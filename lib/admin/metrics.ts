import type { SupabaseClient } from "@supabase/supabase-js";
import { listAllAuthUsers } from "@/lib/admin/auth-users";

export type AdminMetrics = {
  /** Distinct browsers that hit the landing/funnel page. */
  visitors: number;
  visitorsLast7d: number;
  visitorsLast30d: number;

  /** Total accounts in auth.users. */
  signups: number;
  signupsLast7d: number;
  signupsLast30d: number;

  /** Distinct users that have at least one outgoing chat message. */
  chatters: number;

  /** Total outgoing chat messages from real users. */
  totalUserMessages: number;

  /** Average outgoing messages per signed-up user. */
  avgMessagesPerSignup: number;

  /** Users that completed at least one paid credit purchase. */
  payingUsers: number;

  /** Visitors that became signups (via visitor_id linkage). */
  visitorsConvertedToSignup: number;

  /** Visitors whose linked user has at least one chat message. */
  visitorsConvertedToChat: number;
};

export async function loadAdminMetrics(
  service: SupabaseClient,
): Promise<AdminMetrics> {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const since7d = new Date(now - 7 * day).toISOString();
  const since30d = new Date(now - 30 * day).toISOString();

  const [visitorsTotal, visitors7, visitors30, msgRows, profRows, users] =
    await Promise.all([
      service.from("site_visits").select("visitor_id", {
        count: "exact",
        head: true,
      }),
      service
        .from("site_visits")
        .select("visitor_id", { count: "exact", head: true })
        .gte("first_visit_at", since7d),
      service
        .from("site_visits")
        .select("visitor_id", { count: "exact", head: true })
        .gte("first_visit_at", since30d),
      service
        .from("chat_messages")
        .select("owner_user_id, sender")
        .eq("sender", "me"),
      service.from("user_profiles").select("user_id, purchase_count"),
      listAllAuthUsers(service),
    ]);

  const visitors = visitorsTotal.count ?? 0;
  const visitorsLast7d = visitors7.count ?? 0;
  const visitorsLast30d = visitors30.count ?? 0;

  const msgs =
    (msgRows.data as Array<{ owner_user_id: string | null }> | null) ?? [];
  const chatterSet = new Set<string>();
  for (const m of msgs) {
    if (m.owner_user_id) chatterSet.add(m.owner_user_id);
  }
  const totalUserMessages = msgs.length;

  const profiles =
    (profRows.data as Array<{
      user_id: string;
      purchase_count: number | null;
    }> | null) ?? [];
  const payingUsers = profiles.filter(
    (p) => typeof p.purchase_count === "number" && p.purchase_count > 0,
  ).length;

  const signups = users.length;
  const signupsLast7d = users.filter(
    (u) => u.createdAt && u.createdAt >= since7d,
  ).length;
  const signupsLast30d = users.filter(
    (u) => u.createdAt && u.createdAt >= since30d,
  ).length;

  const avgMessagesPerSignup =
    signups > 0 ? totalUserMessages / signups : 0;

  // Visitor → conversion linkage via site_visits.signed_up_user_id.
  const { data: linkedRows } = await service
    .from("site_visits")
    .select("signed_up_user_id")
    .not("signed_up_user_id", "is", null);
  const linked =
    (linkedRows as Array<{ signed_up_user_id: string | null }> | null) ?? [];
  const linkedIds = new Set<string>();
  for (const l of linked) {
    if (l.signed_up_user_id) linkedIds.add(l.signed_up_user_id);
  }
  const visitorsConvertedToSignup = linkedIds.size;

  let visitorsConvertedToChat = 0;
  linkedIds.forEach((id) => {
    if (chatterSet.has(id)) visitorsConvertedToChat += 1;
  });

  return {
    visitors,
    visitorsLast7d,
    visitorsLast30d,
    signups,
    signupsLast7d,
    signupsLast30d,
    chatters: chatterSet.size,
    totalUserMessages,
    avgMessagesPerSignup,
    payingUsers,
    visitorsConvertedToSignup,
    visitorsConvertedToChat,
  };
}

export function pct(num: number, denom: number): number {
  if (denom <= 0) return 0;
  return (num / denom) * 100;
}
