import type { SupabaseClient } from "@supabase/supabase-js";
import {
  FUNNEL_STEP_REGISTER_PAGE,
  FUNNEL_STEP_WELCOME_CTA,
} from "@/lib/analytics/funnel-steps";
import { pct } from "@/lib/admin/metrics";
import type { AppVariant } from "@/lib/app-variant";
import { DEFAULT_APP_VARIANT } from "@/lib/app-variant";
import { SIGNUP_FREE_MESSAGES } from "@/lib/credits/pricing";

export type FunnelRoadmapStep = {
  key: string;
  label: string;
  count: number;
  /** Share of step 1 (visitors). */
  pctOfVisitors: number;
  /** Share of previous step, or null for step 1. */
  pctOfPrevious: number | null;
};

export type FunnelRoadmapMetrics = {
  steps: FunnelRoadmapStep[];
  metricsSince: string | null;
  variant: AppVariant;
};

export type LoadFunnelRoadmapOptions = {
  since?: string | null;
  variant?: AppVariant;
};

export async function loadFunnelRoadmapMetrics(
  service: SupabaseClient,
  options: LoadFunnelRoadmapOptions = {},
): Promise<FunnelRoadmapMetrics> {
  const since = options.since ?? null;
  const variant = options.variant ?? DEFAULT_APP_VARIANT;

  let visitorsQuery = service
    .from("site_visits")
    .select("*", { count: "exact", head: true })
    .eq("app_variant", variant);
  if (since) visitorsQuery = visitorsQuery.gte("first_visit_at", since);
  const { count: visitorsCount, error: visitorsErr } = await visitorsQuery;
  if (visitorsErr) throw new Error(visitorsErr.message);
  const visitors = visitorsCount ?? 0;

  let welcomeCtaQuery = service
    .from("funnel_step_views")
    .select("*", { count: "exact", head: true })
    .eq("app_variant", variant)
    .eq("step", FUNNEL_STEP_WELCOME_CTA);
  if (since) welcomeCtaQuery = welcomeCtaQuery.gte("first_viewed_at", since);
  const { count: welcomeCtaCount, error: welcomeCtaErr } = await welcomeCtaQuery;
  if (welcomeCtaErr) throw new Error(welcomeCtaErr.message);
  const welcomeCta = welcomeCtaCount ?? 0;

  let registerPageQuery = service
    .from("funnel_step_views")
    .select("*", { count: "exact", head: true })
    .eq("app_variant", variant)
    .eq("step", FUNNEL_STEP_REGISTER_PAGE);
  if (since) registerPageQuery = registerPageQuery.gte("first_viewed_at", since);
  const { count: registerPageCount, error: registerPageErr } = await registerPageQuery;
  if (registerPageErr) throw new Error(registerPageErr.message);
  const registerPage = registerPageCount ?? 0;

  let signupsQuery = service
    .from("site_visits")
    .select("signed_up_user_id")
    .eq("app_variant", variant)
    .not("signed_up_user_id", "is", null);
  if (since) signupsQuery = signupsQuery.gte("signed_up_at", since);
  const { data: signupRows, error: signupErr } = await signupsQuery;
  if (signupErr) throw new Error(signupErr.message);

  const signupIds = new Set<string>();
  for (const row of signupRows ?? []) {
    const id = (row as { signed_up_user_id?: string | null }).signed_up_user_id;
    if (id) signupIds.add(id);
  }
  const signups = signupIds.size;

  let outboundByUser = new Map<string, number>();
  if (signupIds.size > 0) {
    let msgQuery = service
      .from("chat_messages")
      .select("owner_user_id, sender, created_at")
      .eq("sender", "me")
      .in("owner_user_id", Array.from(signupIds));
    if (since) msgQuery = msgQuery.gte("created_at", since);

    const { data: msgRows, error: msgErr } = await msgQuery;
    if (msgErr) throw new Error(msgErr.message);

    outboundByUser = new Map<string, number>();
    for (const m of msgRows ?? []) {
      const uid = (m as { owner_user_id?: string | null }).owner_user_id;
      if (!uid) continue;
      outboundByUser.set(uid, (outboundByUser.get(uid) ?? 0) + 1);
    }
  }

  let firstMessage = 0;
  let creditsSpent = 0;
  for (const count of Array.from(outboundByUser.values())) {
    if (count >= 1) firstMessage += 1;
    if (count >= SIGNUP_FREE_MESSAGES) creditsSpent += 1;
  }

  let purchases = 0;
  if (signupIds.size > 0) {
    const { data: profRows, error: profErr } = await service
      .from("user_profiles")
      .select("user_id, purchase_count")
      .in("user_id", Array.from(signupIds))
      .gt("purchase_count", 0);
    if (profErr) throw new Error(profErr.message);
    purchases = profRows?.length ?? 0;
  }

  const counts = [
    visitors,
    welcomeCta,
    registerPage,
    signups,
    firstMessage,
    creditsSpent,
    purchases,
  ];

  const labels = [
    "Websitebezoekers",
    'Klik op "Start discreet rondkijken"',
    "Registratiepagina bezocht",
    "Account aangemaakt",
    "Eerste bericht verstuurd",
    "70 gratis credits opgebruikt",
    "Aankoop gedaan",
  ];

  const keys = [
    "visitors",
    "welcome_cta",
    "register_page",
    "signup",
    "first_message",
    "credits_spent",
    "purchase",
  ];

  const steps: FunnelRoadmapStep[] = counts.map((count, i) => ({
    key: keys[i]!,
    label: labels[i]!,
    count,
    pctOfVisitors: pct(count, visitors),
    pctOfPrevious: i === 0 ? null : pct(count, counts[i - 1]!),
  }));

  return { steps, metricsSince: since, variant };
}
