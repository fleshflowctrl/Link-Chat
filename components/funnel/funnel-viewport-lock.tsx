"use client";

import { useLayoutEffect, type ReactNode } from "react";

const LOCK_HTML = "funnel-scroll-lock";

function targetAllowsWheelScroll(ev: WheelEvent): boolean {
  let el = ev.target as Node | null;
  while (el && el instanceof HTMLElement && el !== document.body) {
    if (el instanceof HTMLTextAreaElement) {
      const sh = el.scrollHeight;
      const ch = el.clientHeight;
      if (sh > ch + 1) {
        const atTop = el.scrollTop <= 0;
        const atBottom = el.scrollTop + ch >= sh - 1;
        if (ev.deltaY < 0 && !atTop) return true;
        if (ev.deltaY > 0 && !atBottom) return true;
      }
    }
    const style = window.getComputedStyle(el);
    const oy = style.overflowY;
    const canY =
      (oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1;
    if (canY) {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if (ev.deltaY < 0 && !atTop) return true;
      if (ev.deltaY > 0 && !atBottom) return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Mount only under `app/(funnel)/layout.tsx`. Locks document scroll / bounce /
 * wheel while the onboarding funnel is active (restored on unmount).
 */
export function FunnelViewportLock({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;

    html.classList.add(LOCK_HTML);
    body.classList.add(LOCK_HTML);

    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyWidth = body.style.width;
    const prevBodyLeft = body.style.left;
    const prevBodyRight = body.style.right;

    body.style.position = "fixed";
    body.style.top = scrollY ? `-${scrollY}px` : "0px";
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    const onWheel = (e: WheelEvent) => {
      if (targetAllowsWheelScroll(e)) return;
      e.preventDefault();
    };

    document.addEventListener("wheel", onWheel, { passive: false, capture: true });

    return () => {
      document.removeEventListener("wheel", onWheel, true);
      html.classList.remove(LOCK_HTML);
      body.classList.remove(LOCK_HTML);
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.width = prevBodyWidth;
      body.style.left = prevBodyLeft;
      body.style.right = prevBodyRight;
      window.scrollTo(0, scrollY);
    };
  }, []);

  return <>{children}</>;
}
