"use client";

import { useLayoutEffect, useState } from "react";

export type ChatViewportState = {
  height: number | null;
  offsetTop: number;
};

/** Track the visible viewport when the mobile keyboard opens (iOS/Android). */
export function useChatViewport(): ChatViewportState {
  const [chatViewport, setChatViewport] = useState<ChatViewportState>({
    height: null,
    offsetTop: 0,
  });

  useLayoutEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setChatViewport({
          height: vv.height,
          offsetTop: vv.offsetTop,
        });
      });
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  return chatViewport;
}

export function isChatKeyboardOpen(viewport: ChatViewportState): boolean {
  if (viewport.height == null) return false;
  return (
    viewport.offsetTop > 0 ||
    viewport.height < window.innerHeight - 80
  );
}
