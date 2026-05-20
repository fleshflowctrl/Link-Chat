import { NextResponse } from "next/server";
import {
  sendPasswordResetEmail,
  sendSignupConfirmationEmail,
} from "@/lib/email/auth-emails";
import { isPostmarkConfigured } from "@/lib/email/postmark";

export const dynamic = "force-dynamic";

type Body = {
  action?: "signup_confirm" | "password_reset";
  email?: string;
  next?: string;
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/**
 * Send auth-related customer emails through Postmark.
 * Used when Supabase built-in mail is off or you want branded templates.
 */
export async function POST(request: Request) {
  if (!isPostmarkConfigured()) {
    return bad(
      "E-mail is niet geconfigureerd (POSTMARK_SERVER_TOKEN ontbreekt)",
      503,
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Ongeldige JSON");
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const action = body.action;
  const next =
    typeof body.next === "string" && body.next.startsWith("/") && !body.next.startsWith("//")
      ? body.next
      : undefined;

  if (!email || !email.includes("@")) {
    return bad("Ongeldig e-mailadres");
  }

  if (action === "signup_confirm") {
    const result = await sendSignupConfirmationEmail({ email, nextPath: next });
    if (!result.ok) return bad(result.error, 500);
    return NextResponse.json({ ok: true });
  }

  if (action === "password_reset") {
    const result = await sendPasswordResetEmail({ email, nextPath: next });
    if (!result.ok) return bad(result.error, 500);
    return NextResponse.json({ ok: true });
  }

  return bad("Onbekende action (signup_confirm | password_reset)");
}
