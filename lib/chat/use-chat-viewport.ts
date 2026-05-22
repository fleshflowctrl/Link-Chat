"use client";

import { useLayoutEffect, useState, type CSSProperties } from "react";

export type ChatViewportState = {
  /** Distance from layout viewport bottom to visual viewport bottom (keyboard). */
  keyboardInset: number;
  offsetTop: number;
  visibleHeight: number;
};

function readViewportState(): ChatViewportState {
  const vv = window.visualViewport;
  if (!vv) {
    return { keyboardInset: 0, offsetTop: 0, visibleHeight: window.innerHeight };
  }
  const keyboardInset = Math.max(
    0,
    window.innerHeight - vv.height - vv.offsetTop,
  );
  return {
    keyboardInset,
    offsetTop: vv.offsetTop,
    visibleHeight: vv.height,
  };
}

/** Track keyboard overlap — whole chat shell follows the visual viewport (WhatsApp-style). */
export function useChatViewport(): ChatViewportState {
  const [chatViewport, setChatViewport] = useState<ChatViewportState>(() =>
    typeof window !== "undefined"
      ? readViewportState()
      : { keyboardInset: 0, offsetTop: 0, visibleHeight: 0 },
  );

  useLayoutEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;
    const sync = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setChatViewport(readViewportState());
      });
    };

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);

  useLayoutEffect(() => {
    if (!isChatKeyboardOpen(chatViewport)) return;
    const lockScroll = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    lockScroll();
    window.visualViewport?.addEventListener("scroll", lockScroll);
    return () => window.visualViewport?.removeEventListener("scroll", lockScroll);
  }, [chatViewport]);

  return chatViewport;
}

export function isChatKeyboardOpen(viewport: ChatViewportState): boolean {
  return viewport.keyboardInset > 48;
}

/**
 * Shrink and shift the entire chat (header + messages + composer) into the
 * visible viewport so the header stays on screen and messages slide up.
 */
export function chatShellStyle(viewport: ChatViewportState): CSSProperties {
  if (!isChatKeyboardOpen(viewport)) {
    return {};
  }
  return {
    position: "fixed",
    top: viewport.offsetTop,
    left: "50%",
    transform: "translateX(-50%)",
    width: "100%",
    maxWidth: 430,
    height: viewport.visibleHeight,
    zIndex: 35,
  };
}
