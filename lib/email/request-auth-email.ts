/** Client-side helper: send auth mail via Postmark API route. */
export async function requestSignupConfirmationEmail(args: {
  email: string;
  nextPath?: string;
}): Promise<void> {
  try {
    await fetch("/api/auth/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        action: "signup_confirm",
        email: args.email,
        next: args.nextPath,
      }),
    });
  } catch {
    /* Postmark optional — Supabase SMTP may still send */
  }
}

export async function requestPasswordResetEmail(args: {
  email: string;
  nextPath?: string;
}): Promise<void> {
  try {
    await fetch("/api/auth/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        action: "password_reset",
        email: args.email,
        next: args.nextPath,
      }),
    });
  } catch {
    /* ignore */
  }
}
