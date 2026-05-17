/** User-facing Dutch copy for common Supabase Auth errors. */
export function mapSupabaseAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (
    lower.includes("already registered") ||
    lower.includes("already been registered") ||
    lower.includes("user already exists")
  ) {
    return (
      "Dit e-mailadres is al geregistreerd. Log in met je wachtwoord. " +
      "Wil je opnieuw beginnen? Verwijder het account in Supabase onder " +
      "Authentication → Users (niet alleen de user_profiles-tabel)."
    );
  }

  if (lower.includes("invalid login credentials")) {
    return "Onjuist e-mailadres of wachtwoord.";
  }

  if (lower.includes("email not confirmed")) {
    return "Bevestig eerst je e-mail via de link in je inbox.";
  }

  if (lower.includes("password") && lower.includes("least")) {
    return message;
  }

  return message;
}
