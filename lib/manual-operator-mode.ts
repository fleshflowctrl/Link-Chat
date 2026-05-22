/**
 * When MANUAL_OPERATOR_MODE=1, no user-facing AI messages are sent automatically.
 * Operators reply via /operator/inbox; AI may only produce draft suggestions.
 */

export function isManualOperatorMode(): boolean {
  const raw = process.env.MANUAL_OPERATOR_MODE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
