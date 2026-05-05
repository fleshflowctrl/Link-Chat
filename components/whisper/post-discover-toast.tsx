"use client";

import { useEffect, useState } from "react";

const KEY = "whisper_discover_toast";

export function PostDiscoverToast() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = sessionStorage.getItem(KEY);
    if (t) {
      sessionStorage.removeItem(KEY);
      setMsg(t);
      const id = window.setTimeout(() => setMsg(null), 3200);
      return () => clearTimeout(id);
    }
  }, []);

  if (!msg) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[100] w-[min(100%,380px)] -translate-x-1/2 px-4">
      <div className="rounded-2xl bg-gray-900/92 px-4 py-3 text-center text-[14px] font-semibold text-white shadow-lg backdrop-blur-sm">
        {msg}
      </div>
    </div>
  );
}
