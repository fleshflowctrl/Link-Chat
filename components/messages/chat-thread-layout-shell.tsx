"use client";

import { useLayoutEffect, type ReactNode } from "react";

/** Prevent the app `main` scroller from stealing the chat when the keyboard opens. */
export function ChatThreadLayoutShell({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const prev = main.style.overflow;
    main.style.overflow = "hidden";
    return () => {
      main.style.overflow = prev;
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden overscroll-none">
      {children}
    </div>
  );
}
