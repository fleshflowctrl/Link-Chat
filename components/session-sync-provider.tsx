"use client";

import { useEffect, useRef } from "react";

import { ensureGuestSession } from "@/lib/auth/guest-session";
import { hydrateClientSessionFromServer } from "@/lib/client-user-session";
import { initCreditsStore } from "@/lib/credits-store";
import {
  processPendingChatsFromServer,
  refreshSessionFromServer,
  requestThreadsRefetch,
} from "@/lib/session-sync";
import { warmInboxThreadsCache } from "@/lib/warm-inbox-cache";

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

    // Guest session + inbox sync run in background — discover SSR already
    // loads profiles; this only enables chat/credits without blocking UI.
    void ensureGuestSession()
      .then(() => hydrateClientSessionFromServer())
      .catch(() => {
        void hydrateClientSessionFromServer();
      });
    void warmInboxThreadsCache();
    void processPendingChatsFromServer().then(() => requestThreadsRefetch());

    sendPresencePing();

    const runChatHeartbeat = () => {
      if (document.visibilityState !== "visible") return;
      void processPendingChatsFromServer().then(() => {
        requestThreadsRefetch();
      });
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshSessionFromServer();
      sendPresencePing();
    };

    heartbeatRef.current = setInterval(runChatHeartbeat, CHAT_HEARTBEAT_MS);
    presenceRef.current = setInterval(sendPresencePing, PRESENCE_HEARTBEAT_MS);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (presenceRef.current) clearInterval(presenceRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
