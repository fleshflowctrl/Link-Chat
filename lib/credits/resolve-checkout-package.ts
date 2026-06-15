import type { CreditPackage } from "@/data/credits";
import { findCreditPackage } from "@/data/credits";
import { canPurchasePackage } from "@/lib/credits/package-access";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export async function resolveCheckoutPackage(
  packageId: string,
): Promise<CreditPackage | "unavailable" | null> {
  const pkg = findCreditPackage(packageId);
  if (!pkg) return null;

  if (!pkg.firstPurchaseOnly) return pkg;

  if (!isSupabaseConfigured()) return pkg;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return pkg;

  const { data: prof } = await supabase
    .from("user_profiles")
    .select("purchase_count")
    .eq("user_id", user.id)
    .maybeSingle();

  const purchaseCount =
    typeof (prof as { purchase_count?: number } | null)?.purchase_count ===
      "number" &&
    (prof as { purchase_count: number }).purchase_count >= 0
      ? (prof as { purchase_count: number }).purchase_count
      : 0;

  if (!canPurchasePackage(pkg, purchaseCount)) {
    return "unavailable";
  }

  return pkg;
}
