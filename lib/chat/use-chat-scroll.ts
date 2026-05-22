"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";

const PIN_THRESHOLD_PX = 96;

/**
 * WhatsApp-style scroll: snap instantly when sending / keyboard opens;
 * only auto-follow new messages while the user is already at the bottom.
 */
export function useChatScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  endRef: RefObject<HTMLDivElement | null>,
  options?: { messageCount: number; keyboardOpen: boolean },
) {
  const pinnedToBottomRef = useRef(true);
  const didInitialScrollRef = useRef(false);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    const distance =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    return distance <= PIN_THRESHOLD_PX;
  }, [scrollRef]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const el = scrollRef.current;
      if (el) {
        const top = el.scrollHeight;
        if (behavior === "auto") {
          el.scrollTop = top;
        } else {
          el.scrollTo({ top, behavior });
        }
        return;
      }
      endRef.current?.scrollIntoView({ behavior, block: "end" });
    },
    [scrollRef, endRef],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      pinnedToBottomRef.current = isNearBottom();
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [isNearBottom, scrollRef]);

  useLayoutEffect(() => {
    if (didInitialScrollRef.current) return;
    didInitialScrollRef.current = true;
    scrollToBottom("auto");
  }, [scrollToBottom]);

  const messageCount = options?.messageCount ?? 0;
  useLayoutEffect(() => {
    if (!didInitialScrollRef.current) return;
    if (!pinnedToBottomRef.current) return;
    scrollToBottom("auto");
  }, [messageCount, scrollToBottom]);

  useLayoutEffect(() => {
    if (!options?.keyboardOpen) return;
    pinnedToBottomRef.current = true;
    scrollToBottom("auto");
    const t = window.setTimeout(() => scrollToBottom("auto"), 120);
    return () => window.clearTimeout(t);
  }, [options?.keyboardOpen, scrollToBottom]);

  const stickToBottom = useCallback(() => {
    pinnedToBottomRef.current = true;
    requestAnimationFrame(() => {
      scrollToBottom("auto");
      requestAnimationFrame(() => scrollToBottom("auto"));
    });
  }, [scrollToBottom]);

  return { scrollToBottom, stickToBottom, isNearBottom, pinnedToBottomRef };
}
