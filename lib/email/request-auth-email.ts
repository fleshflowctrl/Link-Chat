/** Client-side helper: send auth mail via Postmark API route. */
export type AuthEmailRequestResult =
  | { ok: true }
  | { ok: false; error: string };

async function postAuthEmail(body: {
  action: "signup_confirm" | "password_reset";
  email: string;
  nextPath?: string;
}): Promise<AuthEmailRequestResult> {
  try {
    const res = await fetch("/api/auth/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        action: body.action,
        email: body.email,
        next: body.nextPath,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };

    if (!res.ok || !data.ok) {
      return {
        ok: false,
        error:
          data.error ??
          (res.status === 503
            ? "E-mail is niet geconfigureerd op de server."
            : `Versturen mislukt (${res.status})`),
      };
    }

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Kon geen verbinding maken met de server.",
    };
  }
}

export async function requestSignupConfirmationEmail(args: {
  email: string;
  nextPath?: string;
}): Promise<AuthEmailRequestResult> {
  return postAuthEmail({
    action: "signup_confirm",
    email: args.email,
    nextPath: args.nextPath,
  });
}

export async function requestPasswordResetEmail(args: {
  email: string;
  nextPath?: string;
}): Promise<AuthEmailRequestResult> {
  return postAuthEmail({
    action: "password_reset",
    email: args.email,
    nextPath: args.nextPath,
  });
}
