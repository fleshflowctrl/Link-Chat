"use client";

import { useEffect } from "react";

import { hydrateClientSessionFromServer } from "@/lib/client-user-session";
import { initCreditsStore } from "@/lib/credits-store";
import { refreshSessionFromServer } from "@/lib/session-sync";

/**
 * Mounted once in the app shell. Keeps credits (and dispatches thread/unlock
 * refetch events) when the user switches tabs or returns from another device.
 */
export function SessionSyncProvider() {
  useEffect(() => {
    initCreditsStore();
    void hydrateClientSessionFromServer();

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshSessionFromServer();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
