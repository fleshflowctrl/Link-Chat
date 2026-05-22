import type { SupabaseClient } from "@supabase/supabase-js";
import { SITE_DISPLAY, SITE_DOMAIN } from "@/lib/brand";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { isPostmarkConfigured, postmarkFromEmail, sendPostmarkEmail } from "@/lib/email/postmark";

const SIGNUP_LINK_MAX_ATTEMPTS = 6;
const SIGNUP_LINK_RETRY_MS = 450;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type SignupOtpResult = { ok: true; otp: string } | { ok: false; error: string };

/** Supabase `email_otp` via generateLink (magiclink works for new + existing users). */
async function generateSignupConfirmOtp(
  admin: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<SignupOtpResult> {
  let lastError = "";
  for (let attempt = 0; attempt < SIGNUP_LINK_MAX_ATTEMPTS; attempt++) {
    const link = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    const otp = link.data?.properties?.email_otp;
    if (!link.error && otp) {
      return { ok: true, otp: String(otp).trim() };
    }

    lastError = link.error?.message ?? "Onbekende fout";
    const retryable = /not found|does not exist|no user|unable to find/i.test(
      lastError,
    );

    if (!retryable) {
      break;
    }
    await sleep(SIGNUP_LINK_RETRY_MS * (attempt + 1));
  }

  console.error("[auth-email] signup OTP failed:", email, lastError);
  return { ok: false, error: lastError };
}

function formatOtpForDisplay(otp: string): string {
  const digits = otp.replace(/\D/g, "");
  if (digits.length === 6) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  }
  return digits;
}

function appOrigin(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  return `https://${SITE_DOMAIN}`;
}

function authCallbackUrl(nextPath?: string): string {
  const next =
    nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/discover";
  return `${appOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;
}

function wrapHtml(inner: string): string {
  return `<!DOCTYPE html>
<html lang="nl">
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
  <p style="font-size:13px;color:#666;margin:0 0 20px">${SITE_DISPLAY}</p>
  ${inner}
  <p style="font-size:12px;color:#888;margin-top:28px">Je ontving deze mail omdat je een account aanmaakte op ${SITE_DISPLAY}.</p>
</body>
</html>`;
}

/** Send signup confirmation via Postmark (link from Supabase Admin API). */
export async function sendSignupConfirmationEmail(args: {
  email: string;
  nextPath?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPostmarkConfigured()) {
    return { ok: false, error: "Postmark niet geconfigureerd" };
  }

  const admin = getServiceSupabase();
  if (!admin) {
    return { ok: false, error: "Supabase service role ontbreekt" };
  }

  const email = args.email.trim().toLowerCase();
  const redirectTo = authCallbackUrl(args.nextPath);

  const otpResult = await generateSignupConfirmOtp(admin, email, redirectTo);
  if (!otpResult.ok) {
    return {
      ok: false,
      error: `Bevestigingscode mislukt: ${otpResult.error}`,
    };
  }
  const otp = otpResult.otp;
  const otpDisplay = formatOtpForDisplay(otp);
  const confirmUrl = `${appOrigin()}/signup`;

  const subject = `Je bevestigingscode — ${SITE_DISPLAY}`;
  const textBody = [
    `Hoi!`,
    ``,
    `Bedankt voor je registratie bij ${SITE_DISPLAY}.`,
    `Je bevestigingscode is:`,
    ``,
    otp,
    ``,
    `Voer deze code in op ${confirmUrl} om je account te activeren.`,
    `De code verloopt over 1 uur.`,
    ``,
    `Groetjes,`,
    `het team van ${SITE_DISPLAY}`,
  ].join("\n");

  const htmlBody = wrapHtml(`
    <h1 style="font-size:20px;margin:0 0 12px">Bevestig je e-mail</h1>
    <p>Bedankt voor je registratie bij <strong>${SITE_DISPLAY}</strong>.</p>
    <p style="margin:20px 0 8px;font-size:14px;color:#444">Je bevestigingscode:</p>
    <p style="margin:0 0 20px;font-size:32px;font-weight:700;letter-spacing:0.25em;color:#B52B2A">${otpDisplay}</p>
    <p style="font-size:14px;color:#444">Voer deze code in op <a href="${confirmUrl}">${SITE_DISPLAY}</a> om verder te gaan.</p>
    <p style="font-size:12px;color:#888;margin-top:16px">De code verloopt over 1 uur. Heb je je niet aangemeld? Negeer deze mail.</p>
  `);

  const sent = await sendPostmarkEmail({
    to: email,
    subject,
    textBody,
    htmlBody,
    tag: "signup-confirm",
    replyTo: postmarkFromEmail(),
  });

  if (!sent.ok) return sent;
  return { ok: true };
}

/** Password reset e-mail via Postmark. */
export async function sendPasswordResetEmail(args: {
  email: string;
  nextPath?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPostmarkConfigured()) {
    return { ok: false, error: "Postmark niet geconfigureerd" };
  }

  const admin = getServiceSupabase();
  if (!admin) {
    return { ok: false, error: "Supabase service role ontbreekt" };
  }

  const email = args.email.trim().toLowerCase();
  const redirectTo = authCallbackUrl(args.nextPath ?? "/login");

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (error || !data?.properties?.action_link) {
    return {
      ok: false,
      error: error?.message ?? "Wachtwoord-resetlink genereren mislukt",
    };
  }

  const actionLink = data.properties.action_link;
  const subject = `Wachtwoord resetten — ${SITE_DISPLAY}`;
  const textBody = [
    `Je vroeg een nieuw wachtwoord aan voor ${SITE_DISPLAY}.`,
    ``,
    `Klik hier om een nieuw wachtwoord te kiezen:`,
    actionLink,
    ``,
    `Heb je dit niet aangevraagd? Negeer deze mail.`,
  ].join("\n");

  const htmlBody = wrapHtml(`
    <h1 style="font-size:20px;margin:0 0 12px">Wachtwoord resetten</h1>
    <p>Je vroeg een nieuw wachtwoord aan.</p>
    <p><a href="${actionLink}" style="display:inline-block;background:#B52B2A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Nieuw wachtwoord</a></p>
  `);

  const sent = await sendPostmarkEmail({
    to: email,
    subject,
    textBody,
    htmlBody,
    tag: "password-reset",
  });

  if (!sent.ok) return sent;
  return { ok: true };
}
