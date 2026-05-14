import "server-only";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";
import type { CardBrand, SavedPaymentMethod } from "@/lib/payment/cards";

type DbRow = {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  holder_name: string | null;
  is_default: boolean;
  created_at: string;
};

function rowToClient(r: DbRow): SavedPaymentMethod {
  return {
    id: r.id,
    brand: r.brand as CardBrand,
    last4: r.last4,
    expMonth: r.exp_month,
    expYear: r.exp_year,
    holderName: r.holder_name ?? "",
    isDefault: r.is_default,
    createdAt: r.created_at,
  };
}

/**
 * Server-side fetcher for the signed-in user's saved payment methods. Used by
 * the `/me/payment` server component so the page renders with data on first
 * paint instead of flashing a loading state.
 *
 * Returns an empty array for anonymous sessions or when Supabase isn't
 * configured (preserves the same behaviour as the GET API route).
 */
export async function fetchUserPaymentMethodsServer(): Promise<SavedPaymentMethod[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_payment_methods")
    .select("id, brand, last4, exp_month, exp_year, holder_name, is_default, created_at")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return [];
  return ((data ?? []) as DbRow[]).map(rowToClient);
}
