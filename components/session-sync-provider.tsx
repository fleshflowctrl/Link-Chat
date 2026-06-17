"use client";

import { useEffect, useRef } from "react";

import {
  ensureGuestSession,
  isPermanentAuthUser,
} from "@/lib/auth/guest-session";
import {
  clearClientCachesOnLogout,
  hydrateClientSessionForUser,
  hydrateClientSessionFromServer,
} from "@/lib/client-user-session";
import { initCreditsStore } from "@/lib/credits-store";
import {
  processPendingChatsFromServer,
  refreshSessionFromServer,
  requestThreadsRefetch,
} from "@/lib/session-sync";
import { warmInboxThreadsCache } from "@/lib/warm-inbox-cache";
import { createClient } from "@/utils/supabase/client";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

const CHAT_HEARTBEAT_MS = 30_000;
const PRESENCE_HEARTBEAT_MS = 30_000;

function sendPresencePing(): void {
  if (typeof window === "undefined") return;
  if (document.visibilityState !== "visible") return;
  void fetch("/api/me/heartbeat", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => {
    /* presence is best-effort */
  });
}

/**
 * Mounted once in the app shell. Keeps credits (and dispatches thread/unlock
 * refetch events) when the user switches tabs or returns from another device.
 * Also runs a heartbeat so AI replies deliver while the user is on /discover,
 * /messages, etc. — not only inside an open chat.
 */
export function SessionSyncProvider() {
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    initCreditsStore();

    const runChatHeartbeat = () => {
      if (document.visibilityState !== "visible") return;
      void processPendingChatsFromServer().then(() => {
        requestThreadsRefetch();
      });
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (isSupabaseConfigured()) {
        void createClient().auth.getUser();
      }
      void refreshSessionFromServer();
      sendPresencePing();
    };

    async function bootstrapAuth() {
      if (!isSupabaseConfigured()) return;

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && isPermanentAuthUser(session.user)) {
        hydrateClientSessionForUser(session.user.id);
        return;
      }

      try {
        await ensureGuestSession();
      } catch {
        /* guest session is optional */
      }
      await hydrateClientSessionFromServer();
    }

    void bootstrapAuth();
    void warmInboxThreadsCache();
    void processPendingChatsFromServer().then(() => requestThreadsRefetch());

    let unsubscribeAuth: (() => void) | undefined;
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (
          (event === "SIGNED_IN" ||
            event === "TOKEN_REFRESHED" ||
            event === "INITIAL_SESSION") &&
          session?.user &&
          isPermanentAuthUser(session.user)
        ) {
          hydrateClientSessionForUser(session.user.id);
        }
        if (event === "SIGNED_OUT") {
          clearClientCachesOnLogout();
        }
      });
      unsubscribeAuth = () => subscription.unsubscribe();
    }

    sendPresencePing();
    heartbeatRef.current = setInterval(runChatHeartbeat, CHAT_HEARTBEAT_MS);
    presenceRef.current = setInterval(sendPresencePing, PRESENCE_HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      unsubscribeAuth?.();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (presenceRef.current) clearInterval(presenceRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
