import { SITE_DISPLAY } from "@/lib/brand";
import { isPostmarkConfigured, postmarkFromEmail, sendPostmarkEmail } from "@/lib/email/postmark";

function appOrigin(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (url) return url.replace(/\/$/, "");
  return `https://stiekemsamen.nl`;
}

export function unreadMessagePreview(body: string | null, kind: string): string {
  const text = (body ?? "").trim();
  if (kind === "image" || !text) {
    return "Stuurde je een foto";
  }
  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}…`;
}

export function isNotifiableUserEmail(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return false;
  const lower = email.toLowerCase();
  if (lower.endsWith("@guest.whisper.invalid")) return false;
  return true;
}

export async function sendUnreadMessageEmail(args: {
  to: string;
  peerName: string;
  preview: string;
  peerId: string;
  appVariant?: "v1" | "v2";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPostmarkConfigured()) {
    return { ok: false, error: "Postmark niet geconfigureerd" };
  }

  const prefix = args.appVariant === "v2" ? "/v2" : "";
  const chatUrl = `${appOrigin()}${prefix}/messages/${encodeURIComponent(args.peerId)}`;
  const peerName = args.peerName.trim() || "Iemand";
  const preview =
    args.preview.trim() ||
    unreadMessagePreview(null, "text");

  const subject = `Nieuw bericht van ${peerName} — ${SITE_DISPLAY}`;
  const textBody = [
    `${peerName} heeft je een bericht gestuurd:`,
    ``,
    preview,
    ``,
    `Open het gesprek: ${chatUrl}`,
    ``,
    `Je krijgt deze mail omdat je het bericht nog niet hebt geopend op ${SITE_DISPLAY}.`,
  ].join("\n");

  const htmlBody = `<!DOCTYPE html>
<html lang="nl">
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#1a1a1a;max-width:520px;margin:0 auto;padding:24px">
  <p style="font-size:13px;color:#666;margin:0 0 20px">${SITE_DISPLAY}</p>
  <h1 style="font-size:20px;margin:0 0 12px">Nieuw bericht van ${peerName}</h1>
  <p style="background:#f5f3ee;border-radius:12px;padding:14px 16px;font-size:15px;margin:16px 0">${preview}</p>
  <p><a href="${chatUrl}" style="display:inline-block;background:#B52B2A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">Bericht openen</a></p>
  <p style="font-size:12px;color:#888;margin-top:24px">Je ontving deze mail omdat je het gesprek nog niet had geopend.</p>
</body>
</html>`;

  return sendPostmarkEmail({
    to: args.to,
    subject,
    textBody,
    htmlBody,
    tag: "unread-message",
    replyTo: postmarkFromEmail(),
  });
}
