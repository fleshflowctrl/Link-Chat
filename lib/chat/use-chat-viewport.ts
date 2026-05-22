"use client";

import { useLayoutEffect, useState, type CSSProperties } from "react";

export type ChatViewportState = {
  /** Distance from layout viewport bottom to visual viewport bottom (keyboard). */
  keyboardInset: number;
  offsetTop: number;
  offsetLeft: number;
  visibleHeight: number;
  visibleWidth: number;
};

function readViewportState(): ChatViewportState {
  const vv = window.visualViewport;
  if (!vv) {
    return {
      keyboardInset: 0,
      offsetTop: 0,
      offsetLeft: 0,
      visibleHeight: window.innerHeight,
      visibleWidth: window.innerWidth,
    };
  }
  const keyboardInset = Math.max(
    0,
    window.innerHeight - vv.height - vv.offsetTop,
  );
  return {
    keyboardInset,
    offsetTop: vv.offsetTop,
    offsetLeft: vv.offsetLeft,
    visibleHeight: vv.height,
    visibleWidth: vv.width,
  };
}

/** Track keyboard overlap — whole chat shell follows the visual viewport (WhatsApp-style). */
export function useChatViewport(): ChatViewportState {
  const [chatViewport, setChatViewport] = useState<ChatViewportState>(() =>
    typeof window !== "undefined"
      ? readViewportState()
      : {
          keyboardInset: 0,
          offsetTop: 0,
          offsetLeft: 0,
          visibleHeight: 0,
          visibleWidth: 0,
        },
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

  const keyboardOpen = isChatKeyboardOpen(chatViewport);

  useLayoutEffect(() => {
    if (!keyboardOpen) return;

    const scrollY = window.scrollY;
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevTop = document.body.style.top;
    const prevWidth = document.body.style.width;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    const lockScroll = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
    };
    lockScroll();
    window.visualViewport?.addEventListener("scroll", lockScroll);

    return () => {
      window.visualViewport?.removeEventListener("scroll", lockScroll);
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.top = prevTop;
      document.body.style.width = prevWidth;
      window.scrollTo(0, scrollY);
    };
  }, [keyboardOpen]);

  return chatViewport;
}

export function isChatKeyboardOpen(viewport: ChatViewportState): boolean {
  return viewport.keyboardInset > 48;
}

/**
 * Pin the chat column between visual viewport top and bottom (above keyboard).
 * Uses top+bottom instead of height — more reliable on iOS Safari.
 */
export function chatShellStyle(viewport: ChatViewportState): CSSProperties {
  if (!isChatKeyboardOpen(viewport)) {
    return {};
  }
  return {
    position: "fixed",
    top: viewport.offsetTop,
    bottom: viewport.keyboardInset,
    left: viewport.offsetLeft,
    width: viewport.visibleWidth,
    maxWidth: 430,
    zIndex: 35,
  };
}

export function chatShellClassName(keyboardOpen: boolean): string {
  if (!keyboardOpen) {
    return "relative flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas";
  }
  return "fixed z-[35] flex min-h-0 flex-col overflow-hidden bg-canvas";
}
