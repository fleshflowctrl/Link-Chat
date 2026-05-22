"use client";

import { useLayoutEffect, useState, type CSSProperties } from "react";

/** Space reserved for the composer row (input + buttons + padding). */
export const CHAT_COMPOSER_HEIGHT_PX = 76;

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

/** Track keyboard overlap so the composer can sit just above it (iOS Safari). */
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

  return chatViewport;
}

export function isChatKeyboardOpen(viewport: ChatViewportState): boolean {
  return viewport.keyboardInset > 48;
}

/** Pin composer to the bottom edge of the visible viewport (above keyboard). */
export function chatComposerPositionStyle(
  viewport: ChatViewportState,
): CSSProperties {
  if (!isChatKeyboardOpen(viewport)) {
    return { bottom: 0, top: "auto" };
  }
  const top =
    viewport.offsetTop + viewport.visibleHeight - CHAT_COMPOSER_HEIGHT_PX;
  return {
    top: Math.max(viewport.offsetTop, top),
    bottom: "auto",
  };
}
