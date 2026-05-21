/**
 * Postmark transactional email (Server API).
 * @see https://postmarkapp.com/developer/api/email-api
 */

import { SITE_DISPLAY } from "@/lib/brand";

export type PostmarkSendInput = {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  tag?: string;
  replyTo?: string;
};

export type PostmarkSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

function postmarkServerToken(): string | null {
  const t = process.env.POSTMARK_SERVER_TOKEN?.trim();
  return t || null;
}

function postmarkFromAddress(): string {
  return (
    process.env.POSTMARK_FROM_EMAIL?.trim() ||
    process.env.POSTMARK_FROM?.trim() ||
    `info@stiekemefotos.nl`
  );
}

/** Verified sender for Postmark (optional display name in inbox). */
export function postmarkFromEmail(): string {
  const addr = postmarkFromAddress();
  const name =
    process.env.POSTMARK_FROM_NAME?.trim() || SITE_DISPLAY;
  if (name && addr.includes("@") && !addr.includes("<")) {
    return `${name} <${addr}>`;
  }
  return addr;
}

export function isPostmarkConfigured(): boolean {
  return Boolean(postmarkServerToken());
}

export async function sendPostmarkEmail(
  input: PostmarkSendInput,
): Promise<PostmarkSendResult> {
  const token = postmarkServerToken();
  if (!token) {
    return { ok: false, error: "POSTMARK_SERVER_TOKEN ontbreekt" };
  }

  const to = input.to.trim().toLowerCase();
  if (!to || !to.includes("@")) {
    return { ok: false, error: "Ongeldig e-mailadres" };
  }

  const from = postmarkFromEmail();
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: to,
      Subject: input.subject,
      TextBody: input.textBody,
      HtmlBody: input.htmlBody ?? undefined,
      MessageStream: process.env.POSTMARK_MESSAGE_STREAM?.trim() || "outbound",
      Tag: input.tag,
      ReplyTo: input.replyTo,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    MessageID?: string;
    Message?: string;
    ErrorCode?: number;
  };

  if (!res.ok) {
    const msg =
      data.Message ||
      `Postmark fout (${res.status}${data.ErrorCode ? `, code ${data.ErrorCode}` : ""})`;
    return { ok: false, error: msg };
  }

  return {
    ok: true,
    messageId: data.MessageID ?? "",
  };
}
