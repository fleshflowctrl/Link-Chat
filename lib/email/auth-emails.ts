import { SITE_DISPLAY, SITE_DOMAIN } from "@/lib/brand";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { isPostmarkConfigured, postmarkFromEmail, sendPostmarkEmail } from "@/lib/email/postmark";

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

  // User is usually already created via client signUp — magiclink confirms + signs in.
  const magic = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  const actionLink = magic.data?.properties?.action_link;
  if (magic.error || !actionLink) {
    return {
      ok: false,
      error: magic.error?.message ?? "Bevestigingslink genereren mislukt",
    };
  }

  const subject = `Bevestig je e-mail — ${SITE_DISPLAY}`;
  const textBody = [
    `Hoi!`,
    ``,
    `Bedankt voor je registratie bij ${SITE_DISPLAY}.`,
    `Klik op de link hieronder om je e-mailadres te bevestigen:`,
    ``,
    actionLink,
    ``,
    `Werkt de link niet? Kopieer hem in je browser.`,
    ``,
    `Groetjes,`,
    `het team van ${SITE_DISPLAY}`,
  ].join("\n");

  const htmlBody = wrapHtml(`
    <h1 style="font-size:20px;margin:0 0 12px">Bevestig je e-mail</h1>
    <p>Bedankt voor je registratie bij <strong>${SITE_DISPLAY}</strong>.</p>
    <p><a href="${actionLink}" style="display:inline-block;background:#B52B2A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">E-mail bevestigen</a></p>
    <p style="font-size:13px;color:#666">Of kopieer deze link:<br><a href="${actionLink}">${actionLink}</a></p>
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
