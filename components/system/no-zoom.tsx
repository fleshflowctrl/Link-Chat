"use client";

import { useEffect } from "react";

/**
 * iOS Safari ignores `user-scalable=no`, so we also block:
 *   - `gesturestart/change/end` (pinch-to-zoom)
 *   - rapid `touchend` pairs (double-tap zoom)
 *   - multi-touch `touchmove` (pinch fallback)
 *
 * Listeners are added at the document level with `passive: false` so
 * `preventDefault()` actually cancels the gesture. Wheel + ctrl/⌘ is also
 * intercepted to silence trackpad pinch on iPad-like inputs (desktop browser
 * zoom via ⌘+/- still works — that's a browser shortcut we can't override).
 */
export function NoZoom() {
  useEffect(() => {
    const stopGesture = (e: Event) => {
      e.preventDefault();
    };

    let lastTouchEnd = 0;
    const onTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    document.addEventListener("gesturestart", stopGesture);
    document.addEventListener("gesturechange", stopGesture);
    document.addEventListener("gestureend", stopGesture);
    document.addEventListener("touchend", onTouchEnd, { passive: false });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", stopGesture);
      document.removeEventListener("gesturechange", stopGesture);
      document.removeEventListener("gestureend", stopGesture);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("wheel", onWheel);
    };
  }, []);

  return null;
}
