/** Operator inbox / thread refresh while the tab is visible. */

export const OPERATOR_INBOX_POLL_MS = 4_000;
export const OPERATOR_AUTO_REPLY_POLL_MS = 5_000;
export const OPERATOR_THREAD_POLL_MS = 3_000;

export function isOperatorLivePollActive(): boolean {
  return (
    typeof document !== "undefined" &&
    document.visibilityState === "visible"
  );
}
