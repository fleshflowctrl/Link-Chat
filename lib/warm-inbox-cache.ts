import type { MessageThread } from "@/data/messages";
import { writeInboxThreadsCache } from "@/lib/inbox-threads-cache";
import { hydrateClientSessionForUser } from "@/lib/client-user-session";

let inflight: Promise<MessageThread[] | null> | null = null;

/** Prefetch inbox threads into sessionStorage (deduped). */
export function warmInboxThreadsCache(): Promise<MessageThread[] | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const r = await fetch("/api/me/threads", { cache: "no-store" });
      if (!r.ok) return null;
      const json = (await r.json()) as {
        ok?: boolean;
        threads?: MessageThread[];
        userId?: string;
      };
      if (!json.ok) return null;
      if (json.userId) hydrateClientSessionForUser(json.userId);
      const threads = json.threads ?? [];
      if (threads.length > 0) writeInboxThreadsCache(threads);
      return threads;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
