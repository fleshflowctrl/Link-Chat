import type { SupabaseClient } from "@supabase/supabase-js";
import { listAllAuthUsers, type AdminAuthUser } from "@/lib/admin/auth-users";
import { STARTING_USER_CREDITS } from "@/lib/credits/pricing";

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

  /** Distinct users that clicked the "Betaal" button on the credits page. */
  checkoutClickers: number;
  /** Total clicks on the checkout button (incl. repeats from same user). */
  checkoutClicks: number;
  /** Total successful credit purchases recorded in credit_purchases. */
  paidPurchases: number;
  /** Clicks in the last 7 days. */
  checkoutClicksLast7d: number;
  /** Successful purchases in the last 7 days. */
  paidPurchasesLast7d: number;

  /** Visitors that became signups (via visitor_id linkage). */
  visitorsConvertedToSignup: number;

  /** Visitors whose linked user has at least one chat message. */
  visitorsConvertedToChat: number;

  /** Per-step funnel reach (distinct visitors who saw each step). */
  funnelSteps: Array<{ step: number; label: string; visitors: number }>;

  /** Total credits ever credited to all signed-up users (start + rewards + purchases). */
  creditsCreditedTotal: number;
  /** Current credit balance summed across all signed-up users. */
  creditsBalanceTotal: number;
  /** Total credits spent = credited - current balance (never negative). */
  creditsSpentTotal: number;
  /** Average credits spent per signed-up user. */
  avgCreditsSpentPerSignup: number;
  /** Average credits spent among users that sent at least one message. */
  avgCreditsSpentPerChatter: number;

  /** D1/D7/D30 retention buckets (chat activity ≥ N days after signup). */
  retention: Array<{
    /** Number of days after signup (1, 7, 30). */
    days: number;
    /** Users whose account is at least `days` days old. */
    eligible: number;
    /** Of the eligible cohort, how many were still active ≥ N days later. */
    retained: number;
  }>;

  /** Signed-in users with a heartbeat in the last PRESENCE_WINDOW_MS. */
  usersOnlineNow: number;

  /** ISO timestamp the live view counts from (`null` = all-time). */
  metricsSince: string | null;
};

/** How recent a heartbeat counts as "online" (3× the 30s ping cadence). */
const PRESENCE_WINDOW_MS = 90_000;

/** Labels for the 7-step onboarding funnel. Update if steps change. */
export const FUNNEL_STEP_LABELS: Record<number, string> = {
  1: "Welkom",
  2: "Op zoek naar",
  3: "Geslacht",
  4: "Voorkeurs-geslacht",
  5: "Eerste match kiezen",
  6: "Eerste bericht",
  7: "Account aanmaken",
};

export type LoadMetricsOptions = {
  /** ISO timestamp — when set, every count is filtered to events
   *  happening on/after this moment. `null`/undefined = all-time. */
  since?: string | null;
};

/**
 * Aggregates the admin dashboard metrics. Pass `since` to compute the
 * "live" view that counts from the last reset; omit it for the all-time
 * dashboard.
 */
export async function loadAdminMetrics(
  service: SupabaseClient,
  options: LoadMetricsOptions = {},
): Promise<AdminMetrics> {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const since7d = new Date(now - 7 * day).toISOString();
  const since30d = new Date(now - 30 * day).toISOString();
  const since = options.since ?? null;

  // ---------------------------------------------------------------------
  // Query builders. Each is conditionally filtered by `since` on the
  // appropriate timestamp column so the live view starts fresh after a
  // reset while the all-time view keeps everything.
  // ---------------------------------------------------------------------
  let visitorsTotalQuery = service
    .from("site_visits")
    .select("visitor_id", { count: "exact", head: true });
  if (since) visitorsTotalQuery = visitorsTotalQuery.gte("first_visit_at", since);

  const visitors7Query = service
    .from("site_visits")
    .select("visitor_id", { count: "exact", head: true })
    .gte("first_visit_at", since && since > since7d ? since : since7d);

  const visitors30Query = service
    .from("site_visits")
    .select("visitor_id", { count: "exact", head: true })
    .gte("first_visit_at", since && since > since30d ? since : since30d);

  let msgQuery = service
    .from("chat_messages")
    .select("owner_user_id, sender, created_at")
    .eq("sender", "me");
  if (since) msgQuery = msgQuery.gte("created_at", since);

  // user_profiles holds the *current* balance & last heartbeat; reset
  // doesn't touch either column.
  const profileQuery = service
    .from("user_profiles")
    .select("user_id, purchase_count, credits, last_active_at");

  let clicksTotalQuery = service
    .from("credit_checkout_clicks")
    .select("id", { count: "exact", head: true });
  if (since) clicksTotalQuery = clicksTotalQuery.gte("created_at", since);

  const clicks7Query = service
    .from("credit_checkout_clicks")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since && since > since7d ? since : since7d);

  let clickRowsQuery = service.from("credit_checkout_clicks").select("user_id");
  if (since) clickRowsQuery = clickRowsQuery.gte("created_at", since);

  let purchasesTotalQuery = service
    .from("credit_purchases")
    .select("id", { count: "exact", head: true });
  if (since) purchasesTotalQuery = purchasesTotalQuery.gte("created_at", since);

  const purchases7Query = service
    .from("credit_purchases")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since && since > since7d ? since : since7d);

  let stepViewQuery = service.from("funnel_step_views").select("step");
  if (since) stepViewQuery = stepViewQuery.gte("first_viewed_at", since);

  let purchaseGrantQuery = service
    .from("credit_purchases")
    .select("user_id, granted_credits");
  if (since) purchaseGrantQuery = purchaseGrantQuery.gte("created_at", since);

  let rewardQuery = service
    .from("user_profile_rewards")
    .select("owner_user_id, credits_paid");
  if (since) rewardQuery = rewardQuery.gte("awarded_at", since);

  const [
    visitorsTotal,
    visitors7,
    visitors30,
    msgRows,
    profRows,
    allUsers,
    clicksTotal,
    clicks7d,
    clickRows,
    purchasesTotal,
    purchases7d,
    stepViewRows,
    purchaseGrantRows,
    rewardRows,
  ] = await Promise.all([
    visitorsTotalQuery,
    visitors7Query,
    visitors30Query,
    msgQuery,
    profileQuery,
    listAllAuthUsers(service),
    clicksTotalQuery,
    clicks7Query,
    clickRowsQuery,
    purchasesTotalQuery,
    purchases7Query,
    stepViewQuery,
    purchaseGrantQuery,
    rewardQuery,
  ]);

  const visitors = visitorsTotal.count ?? 0;
  const visitorsLast7d = visitors7.count ?? 0;
  const visitorsLast30d = visitors30.count ?? 0;

  // Restrict the user cohort itself when a cutoff is set so all per-user
  // metrics (paying, credits-spent, retention) describe the same window.
  const users: AdminAuthUser[] = since
    ? allUsers.filter((u) => u.createdAt && u.createdAt >= since)
    : allUsers;
  const cohortIds = new Set(users.map((u) => u.id));

  const msgs =
    (msgRows.data as Array<{
      owner_user_id: string | null;
      created_at: string | null;
    }> | null) ?? [];
  const chatterSet = new Set<string>();
  /** Latest message timestamp per user (ms epoch) — used for retention. */
  const lastActiveByUser = new Map<string, number>();
  for (const m of msgs) {
    if (!m.owner_user_id) continue;
    chatterSet.add(m.owner_user_id);
    const ts = m.created_at ? Date.parse(m.created_at) : NaN;
    if (Number.isFinite(ts)) {
      const prev = lastActiveByUser.get(m.owner_user_id) ?? 0;
      if (ts > prev) lastActiveByUser.set(m.owner_user_id, ts);
    }
  }
  const totalUserMessages = msgs.length;

  const profiles =
    (profRows.data as Array<{
      user_id: string;
      purchase_count: number | null;
      credits: number | null;
      last_active_at: string | null;
    }> | null) ?? [];

  // "Online now" = any signed-in user whose last heartbeat is within
  // the presence window. This always reflects the live state — it is
  // intentionally not gated by the metrics_since cutoff.
  const onlineCutoffMs = now - PRESENCE_WINDOW_MS;
  let usersOnlineNow = 0;
  for (const p of profiles) {
    if (!p.last_active_at) continue;
    const ts = Date.parse(p.last_active_at);
    if (Number.isFinite(ts) && ts >= onlineCutoffMs) usersOnlineNow += 1;
  }

  // Paying = profile.purchase_count > 0, restricted to the cohort when a
  // cutoff is set. (purchase_count is cumulative; the credit_purchases
  // counts above are the cutoff-aware version of that signal.)
  const payingUsers = profiles.filter((p) => {
    if (typeof p.purchase_count !== "number" || p.purchase_count <= 0) return false;
    if (since && !cohortIds.has(p.user_id)) return false;
    return true;
  }).length;

  // Per-user credit accounting on the active cohort.
  //   credited = STARTING + rewards-within-window + grants-within-window
  //   spent    = credited - current_balance
  const balanceByUser = new Map<string, number>();
  for (const p of profiles) {
    if (typeof p.credits === "number") balanceByUser.set(p.user_id, Math.max(0, p.credits));
  }

  const purchaseGrantByUser = new Map<string, number>();
  const purchaseGrants =
    (purchaseGrantRows.data as Array<{
      user_id: string | null;
      granted_credits: number | null;
    }> | null) ?? [];
  for (const row of purchaseGrants) {
    if (!row.user_id || typeof row.granted_credits !== "number") continue;
    purchaseGrantByUser.set(
      row.user_id,
      (purchaseGrantByUser.get(row.user_id) ?? 0) + row.granted_credits,
    );
  }

  const rewardsByUser = new Map<string, number>();
  const rewardRowsTyped =
    (rewardRows.data as Array<{
      owner_user_id: string | null;
      credits_paid: number | null;
    }> | null) ?? [];
  for (const row of rewardRowsTyped) {
    if (!row.owner_user_id || typeof row.credits_paid !== "number") continue;
    rewardsByUser.set(
      row.owner_user_id,
      (rewardsByUser.get(row.owner_user_id) ?? 0) + row.credits_paid,
    );
  }

  let creditsCreditedTotal = 0;
  let creditsBalanceTotal = 0;
  let creditsSpentTotal = 0;
  let chatterCreditsSpent = 0;
  for (const u of users) {
    const id = u.id;
    const balance = balanceByUser.get(id) ?? 0;
    const grants = purchaseGrantByUser.get(id) ?? 0;
    const rewards = rewardsByUser.get(id) ?? 0;
    const credited = STARTING_USER_CREDITS + grants + rewards;
    const spent = Math.max(0, credited - balance);
    creditsCreditedTotal += credited;
    creditsBalanceTotal += balance;
    creditsSpentTotal += spent;
    if (chatterSet.has(id)) chatterCreditsSpent += spent;
  }
  const avgCreditsSpentPerSignup =
    users.length > 0 ? creditsSpentTotal / users.length : 0;
  const avgCreditsSpentPerChatter =
    chatterSet.size > 0 ? chatterCreditsSpent / chatterSet.size : 0;

  // Retention: standard Day-N within the active cohort.
  const retentionDays = [1, 7, 30];
  const retention = retentionDays.map((days) => {
    const cutoffMs = days * day;
    let eligible = 0;
    let retained = 0;
    for (const u of users) {
      const signupMs = u.createdAt ? Date.parse(u.createdAt) : NaN;
      if (!Number.isFinite(signupMs)) continue;
      const ageMs = now - signupMs;
      if (ageMs < cutoffMs) continue;
      eligible += 1;
      const lastActive = lastActiveByUser.get(u.id);
      if (typeof lastActive === "number" && lastActive - signupMs >= cutoffMs) {
        retained += 1;
      }
    }
    return { days, eligible, retained };
  });

  const signups = users.length;
  const signupsLast7d = users.filter(
    (u) => u.createdAt && u.createdAt >= since7d,
  ).length;
  const signupsLast30d = users.filter(
    (u) => u.createdAt && u.createdAt >= since30d,
  ).length;

  const avgMessagesPerSignup =
    signups > 0 ? totalUserMessages / signups : 0;

  const checkoutClicks = clicksTotal.count ?? 0;
  const checkoutClicksLast7d = clicks7d.count ?? 0;
  const paidPurchases = purchasesTotal.count ?? 0;
  const paidPurchasesLast7d = purchases7d.count ?? 0;

  const clickRowsTyped =
    (clickRows.data as Array<{ user_id: string | null }> | null) ?? [];
  const checkoutClickerSet = new Set<string>();
  for (const c of clickRowsTyped) {
    if (c.user_id) checkoutClickerSet.add(c.user_id);
  }
  const checkoutClickers = checkoutClickerSet.size;

  // Per-step funnel reach (distinct visitors per step).
  const stepCounts = new Map<number, number>();
  const rawSteps =
    (stepViewRows.data as Array<{ step: number | null }> | null) ?? [];
  for (const row of rawSteps) {
    if (typeof row.step !== "number") continue;
    stepCounts.set(row.step, (stepCounts.get(row.step) ?? 0) + 1);
  }
  const stepKeys = Object.keys(FUNNEL_STEP_LABELS)
    .map((k) => Number(k))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const funnelSteps = stepKeys.map((step) => ({
    step,
    label: FUNNEL_STEP_LABELS[step] ?? `Stap ${step}`,
    visitors: stepCounts.get(step) ?? 0,
  }));

  // Visitor → conversion linkage via site_visits.signed_up_user_id.
  let linkedQuery = service
    .from("site_visits")
    .select("signed_up_user_id")
    .not("signed_up_user_id", "is", null);
  if (since) linkedQuery = linkedQuery.gte("first_visit_at", since);
  const { data: linkedRows } = await linkedQuery;
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
    checkoutClickers,
    checkoutClicks,
    paidPurchases,
    checkoutClicksLast7d,
    paidPurchasesLast7d,
    visitorsConvertedToSignup,
    visitorsConvertedToChat,
    funnelSteps,
    creditsCreditedTotal,
    creditsBalanceTotal,
    creditsSpentTotal,
    avgCreditsSpentPerSignup,
    avgCreditsSpentPerChatter,
    retention,
    usersOnlineNow,
    metricsSince: since,
  };
}

export function pct(num: number, denom: number): number {
  if (denom <= 0) return 0;
  return (num / denom) * 100;
}
