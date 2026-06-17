import type { SupabaseClient } from "@supabase/supabase-js";
import { listAllAuthUsers, type AdminAuthUser } from "@/lib/admin/auth-users";
import {
  buildMetricsPeriodRows,
  type MetricsPeriodInput,
  type MetricsPeriodRow,
} from "@/lib/admin/metrics-periods";
import type { AppVariant } from "@/lib/app-variant";
import { DEFAULT_APP_VARIANT } from "@/lib/app-variant";

export type { MetricsPeriodRow } from "@/lib/admin/metrics-periods";

export type AdminMetrics = {
  /** Distinct visitors (unique visitor_id in site_visits). */
  visitors: number;
  users: number;
  conversations: number;
  openChats: number;
  purchases: number;
  revenueCents: number;
  avgRevenuePerUserCents: number;
  avgLtvPayingUserCents: number;
  creditsSold: number;
  signupMobilePct: number;
  signupDesktopPct: number;
  messagesProfile7d: number;
  messagesUsers7d: number;
  messagesTotal7d: number;
  periodMonths: MetricsPeriodRow[];
  metricsSince: string | null;
};

export type LoadMetricsOptions = {
  since?: string | null;
  variant?: AppVariant;
};

type MetricsRawData = MetricsPeriodInput & {
  visitors: number;
  conversations: number;
  openChats: number;
  messagesProfile7d: number;
  messagesUsers7d: number;
  messagesTotal7d: number;
  revenueCents: number;
  creditsSold: number;
  signupMobilePct: number;
  signupDesktopPct: number;
};

function isMobileUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
    ua,
  );
}

function threadKey(ownerId: string, peerId: string): string {
  return `${ownerId}::${peerId}`;
}

export function pct(num: number, denom: number): number {
  if (denom <= 0) return 0;
  return (num / denom) * 100;
}

async function loadMetricsRawData(
  service: SupabaseClient,
  options: LoadMetricsOptions,
): Promise<MetricsRawData> {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const since7d = new Date(now - 7 * day).toISOString();
  const since = options.since ?? null;
  const variant = options.variant ?? DEFAULT_APP_VARIANT;

  let allMsgQuery = service
    .from("chat_messages")
    .select("owner_user_id, peer_id, sender, created_at");
  if (since) allMsgQuery = allMsgQuery.gte("created_at", since);

  const msg7dQuery = service
    .from("chat_messages")
    .select("owner_user_id, sender, created_at")
    .gte("created_at", since && since > since7d ? since : since7d);

  const profileQuery = service
    .from("user_profiles")
    .select("user_id, purchase_count, app_variant")
    .eq("app_variant", variant);

  let purchasesQuery = service
    .from("credit_purchases")
    .select(
      "user_id, amount_cents, granted_credits, purchase_count_before, created_at",
    );
  if (since) purchasesQuery = purchasesQuery.gte("created_at", since);

  let signupVisitsQuery = service
    .from("site_visits")
    .select("signed_up_user_id, user_agent")
    .eq("app_variant", variant)
    .not("signed_up_user_id", "is", null);
  if (since) signupVisitsQuery = signupVisitsQuery.gte("signed_up_at", since);

  let visitorsCountQuery = service
    .from("site_visits")
    .select("visitor_id", { count: "exact", head: true })
    .eq("app_variant", variant);
  if (since) visitorsCountQuery = visitorsCountQuery.gte("first_visit_at", since);

  const queueQuery = service
    .from("chat_operator_queue")
    .select("owner_user_id, needs_operator_reply, operator_status");

  const [
    msgRows,
    msg7dRows,
    profRows,
    allUsers,
    purchaseRows,
    signupVisitRows,
    visitorsTotal,
    queueRows,
  ] = await Promise.all([
    allMsgQuery,
    msg7dQuery,
    profileQuery,
    listAllAuthUsers(service),
    purchasesQuery,
    signupVisitsQuery,
    visitorsCountQuery,
    queueQuery,
  ]);

  const visitors = visitorsTotal.count ?? 0;

  const variantProfileIds = new Set(
    ((profRows.data as Array<{ user_id: string }> | null) ?? []).map(
      (p) => p.user_id,
    ),
  );

  let users: AdminAuthUser[] = allUsers.filter((u) =>
    variantProfileIds.has(u.id),
  );
  if (since) {
    users = users.filter((u) => u.createdAt && u.createdAt >= since);
  }
  const cohortIds = new Set(users.map((u) => u.id));

  const threadSet = new Set<string>();
  const chatterSet = new Set<string>();
  const aiFunnelSet = new Set<string>();

  for (const m of (msgRows.data as Array<{
    owner_user_id: string | null;
    peer_id: string | null;
    sender: string | null;
  }> | null) ?? []) {
    if (!m.owner_user_id || !m.peer_id || !variantProfileIds.has(m.owner_user_id)) {
      continue;
    }
    threadSet.add(threadKey(m.owner_user_id, m.peer_id));
    if (m.sender === "me") chatterSet.add(m.owner_user_id);
    if (m.sender === "peer") aiFunnelSet.add(m.owner_user_id);
  }

  let messagesProfile7d = 0;
  let messagesUsers7d = 0;
  for (const m of (msg7dRows.data as Array<{
    owner_user_id: string | null;
    sender: string | null;
  }> | null) ?? []) {
    if (!m.owner_user_id || !variantProfileIds.has(m.owner_user_id)) continue;
    if (m.sender === "peer") messagesProfile7d += 1;
    if (m.sender === "me") messagesUsers7d += 1;
  }

  const payingUserIds = new Set<string>();
  for (const p of (profRows.data as Array<{
    user_id: string;
    purchase_count: number | null;
  }> | null) ?? []) {
    if (typeof p.purchase_count !== "number" || p.purchase_count <= 0) continue;
    if (since && !cohortIds.has(p.user_id)) continue;
    payingUserIds.add(p.user_id);
  }

  const variantPurchases = (
    (purchaseRows.data as Array<{
      user_id: string | null;
      amount_cents: number | null;
      granted_credits: number | null;
      purchase_count_before: number | null;
      created_at: string | null;
    }> | null) ?? []
  ).filter((p) => p.user_id && variantProfileIds.has(p.user_id));

  let revenueCents = 0;
  let creditsSold = 0;
  for (const p of variantPurchases) {
    if (typeof p.amount_cents === "number") revenueCents += p.amount_cents;
    if (typeof p.granted_credits === "number") creditsSold += p.granted_credits;
  }

  const openStatuses = new Set(["open", "waiting_operator"]);
  let openChats = 0;
  for (const q of (queueRows.data as Array<{
    owner_user_id: string;
    needs_operator_reply: boolean;
    operator_status: string;
  }> | null) ?? []) {
    if (!variantProfileIds.has(q.owner_user_id)) continue;
    if (q.needs_operator_reply || openStatuses.has(q.operator_status)) {
      openChats += 1;
    }
  }

  let mobileSignups = 0;
  let desktopSignups = 0;
  let knownDeviceSignups = 0;
  const seenSignupDevice = new Set<string>();
  for (const v of (signupVisitRows.data as Array<{
    signed_up_user_id: string | null;
    user_agent: string | null;
  }> | null) ?? []) {
    if (!v.signed_up_user_id || !cohortIds.has(v.signed_up_user_id)) continue;
    if (!v.user_agent || seenSignupDevice.has(v.signed_up_user_id)) continue;
    seenSignupDevice.add(v.signed_up_user_id);
    knownDeviceSignups += 1;
    if (isMobileUserAgent(v.user_agent)) mobileSignups += 1;
    else desktopSignups += 1;
  }

  return {
    since,
    variant,
    users: users.map((u) => ({ id: u.id, createdAt: u.createdAt })),
    purchases: variantPurchases
      .filter((p) => p.user_id && p.created_at)
      .map((p) => ({
        userId: p.user_id!,
        amountCents: p.amount_cents ?? 0,
        purchaseCountBefore: p.purchase_count_before ?? 0,
        createdAt: p.created_at!,
      })),
    chatterIds: chatterSet,
    aiFunnelIds: aiFunnelSet,
    payingUserIds,
    repeatPurchaseCount: variantPurchases.filter(
      (p) => (p.purchase_count_before ?? 0) > 0,
    ).length,
    visitors,
    conversations: threadSet.size,
    openChats,
    messagesProfile7d,
    messagesUsers7d,
    messagesTotal7d: messagesProfile7d + messagesUsers7d,
    revenueCents,
    creditsSold,
    signupMobilePct: pct(mobileSignups, knownDeviceSignups),
    signupDesktopPct: pct(desktopSignups, knownDeviceSignups),
  };
}

function rawToAdminMetrics(raw: MetricsRawData): AdminMetrics {
  const userCount = raw.users.length;
  const payingUsers = raw.payingUserIds.size;
  return {
    visitors: raw.visitors,
    users: userCount,
    conversations: raw.conversations,
    openChats: raw.openChats,
    purchases: raw.purchases.length,
    revenueCents: raw.revenueCents,
    avgRevenuePerUserCents:
      userCount > 0 ? Math.round(raw.revenueCents / userCount) : 0,
    avgLtvPayingUserCents:
      payingUsers > 0 ? Math.round(raw.revenueCents / payingUsers) : 0,
    creditsSold: raw.creditsSold,
    signupMobilePct: raw.signupMobilePct,
    signupDesktopPct: raw.signupDesktopPct,
    messagesProfile7d: raw.messagesProfile7d,
    messagesUsers7d: raw.messagesUsers7d,
    messagesTotal7d: raw.messagesTotal7d,
    periodMonths: buildMetricsPeriodRows(raw, "month"),
    metricsSince: raw.since,
  };
}

export async function loadAdminMetrics(
  service: SupabaseClient,
  options: LoadMetricsOptions = {},
): Promise<AdminMetrics> {
  const raw = await loadMetricsRawData(service, options);
  return rawToAdminMetrics(raw);
}

export async function loadMetricsPeriodDrilldown(
  service: SupabaseClient,
  options: LoadMetricsOptions & {
    level: "week" | "day";
    parentKey: string;
  },
): Promise<MetricsPeriodRow[]> {
  const raw = await loadMetricsRawData(service, options);
  return buildMetricsPeriodRows(raw, options.level, options.parentKey);
}
