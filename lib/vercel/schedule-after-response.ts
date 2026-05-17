/**
 * Run async work after the route handler returns (Vercel waitUntil or local
 * fire-and-forget). Used for background chat delivery without blocking UX.
 */
export async function scheduleAfterResponse(
  fn: () => Promise<unknown>,
): Promise<void> {
  const p = (async () => {
    try {
      await fn();
    } catch (e) {
      console.warn(
        "[schedule-after-response]",
        e instanceof Error ? e.message : String(e),
      );
    }
  })();

  if (process.env.VERCEL) {
    try {
      const mod = await import("@vercel/functions");
      if (typeof mod.waitUntil === "function") {
        mod.waitUntil(p);
        return;
      }
    } catch {
      /* fall through */
    }
  }
  p.catch(() => undefined);
}
