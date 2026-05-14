import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";
import {
  type CardBrand,
  detectBrand,
  expiryNotPast,
  luhnValid,
} from "@/lib/payment/cards";

export const dynamic = "force-dynamic";

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

function rowToClient(r: DbRow) {
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

/** List all saved payment methods for the signed-in user. */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, methods: [], anonymous: true });
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: true, methods: [], anonymous: true });
  }

  const { data, error } = await supabase
    .from("user_payment_methods")
    .select("id, brand, last4, exp_month, exp_year, holder_name, is_default, created_at")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    methods: ((data ?? []) as DbRow[]).map(rowToClient),
  });
}

/**
 * Add a new payment method.
 *
 * Body: { number: string, expMonth: number, expYear: number, holderName?: string,
 *         setDefault?: boolean }
 *
 * The full card number is validated server-side (Luhn + length) and only the
 * detected brand + last 4 digits are persisted. CVC is never sent or stored.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const numberRaw = typeof obj.number === "string" ? obj.number : "";
  const digits = numberRaw.replace(/\D/g, "");
  const expMonth = Number(obj.expMonth);
  const expYear = Number(obj.expYear);
  const holderName =
    typeof obj.holderName === "string" ? obj.holderName.trim().slice(0, 60) : "";
  const setDefault = Boolean(obj.setDefault);

  if (!luhnValid(digits)) {
    return NextResponse.json(
      { ok: false, error: "Ongeldig kaartnummer" },
      { status: 400 },
    );
  }
  if (
    !Number.isInteger(expMonth) || expMonth < 1 || expMonth > 12 ||
    !Number.isInteger(expYear) || expYear < 2020 || expYear > 2100
  ) {
    return NextResponse.json(
      { ok: false, error: "Ongeldige vervaldatum" },
      { status: 400 },
    );
  }
  if (!expiryNotPast(expMonth, expYear)) {
    return NextResponse.json(
      { ok: false, error: "Kaart is verlopen" },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "supabase not configured" },
      { status: 503 },
    );
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  const brand = detectBrand(digits);
  const last4 = digits.slice(-4);

  // First card auto-becomes default; otherwise honor the request.
  const { count } = await supabase
    .from("user_payment_methods")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const willBeDefault = (count ?? 0) === 0 || setDefault;

  // Clear any existing default before inserting a new default to satisfy the
  // partial unique index.
  if (willBeDefault) {
    await supabase
      .from("user_payment_methods")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("is_default", true);
  }

  const { data: inserted, error } = await supabase
    .from("user_payment_methods")
    .insert({
      user_id: user.id,
      brand,
      last4,
      exp_month: expMonth,
      exp_year: expYear,
      holder_name: holderName,
      is_default: willBeDefault,
    })
    .select("id, brand, last4, exp_month, exp_year, holder_name, is_default, created_at")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "insert failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, method: rowToClient(inserted as DbRow) });
}
