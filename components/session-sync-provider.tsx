"use client";

import { useEffect, useRef } from "react";

import { hydrateClientSessionFromServer } from "@/lib/client-user-session";
import { initCreditsStore } from "@/lib/credits-store";
import {
  processPendingChatsFromServer,
  refreshSessionFromServer,
  requestThreadsRefetch,
} from "@/lib/session-sync";

const CHAT_HEARTBEAT_MS = 45_000;

/**
 * Mounted once in the app shell. Keeps credits (and dispatches thread/unlock
 * refetch events) when the user switches tabs or returns from another device.
 * Also runs a heartbeat so AI replies deliver while the user is on /discover,
 * /messages, etc. — not only inside an open chat.
 */
export function SessionSyncProvider() {
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    initCreditsStore();
    void hydrateClientSessionFromServer();

    const runChatHeartbeat = () => {
      if (document.visibilityState !== "visible") return;
      void processPendingChatsFromServer().then(() => {
        requestThreadsRefetch();
      });
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshSessionFromServer();
    };

    heartbeatRef.current = setInterval(runChatHeartbeat, CHAT_HEARTBEAT_MS);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
