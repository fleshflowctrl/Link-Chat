"use client";

import Link from "next/link";
import { APP_PAGE_PADDING_X } from "@/lib/responsive-shell";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import {
  getMessagesTabBadgeLabel,
  setServerUnreadBaseline,
  subscribeMessagesTabBadge,
} from "@/lib/messages-tab-badge";
import {
  isPermanentCreditsUser,
  subscribeCredits,
} from "@/lib/credits-store";
import { warmInboxThreadsCache } from "@/lib/warm-inbox-cache";
import { appVariantFetchHeaders, readClientAppVariant } from "@/lib/app-variant";
import { WHISPER_THREADS_REFETCH } from "@/lib/session-sync";
import {
  Coins,
  MessageCircle,
  Search,
  User,
} from "lucide-react";

const GRAY = "#9CA3AF";

const TAB_SUFFIXES = [
  { suffix: "/discover", label: "Ontdekken", Icon: Search, badge: null as string | null },
  {
    suffix: "/messages",
    label: "Berichten",
    Icon: MessageCircle,
    badge: null as string | null,
  },
  { suffix: "/me", label: "Profiel", Icon: User, badge: null },
  { suffix: "/credits", label: "Berichtenbundels", Icon: Coins, badge: null },
] as const;

function isActive(pathname: string, href: string) {
  if (href.endsWith("/discover")) {
    return (
      pathname === href ||
      pathname === `${href}/new` ||
      pathname.startsWith(`${href}/new/`)
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function hideBottomNavOnPath(pathname: string | null) {
  if (!pathname) return false;
  const m = pathname.match(/^\/(?:v2\/)?messages\/([^/]+)$/);
  return Boolean(m && m[1] !== "new");
}

async function fetchUnreadCount(): Promise<number | null> {
  try {
    const res = await fetch("/api/me/unread-count", {
      cache: "no-store",
      credentials: "same-origin",
      headers: appVariantFetchHeaders(readClientAppVariant()),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; count?: number };
    if (!data?.ok || typeof data.count !== "number") return null;
    return Math.max(0, Math.floor(data.count));
  } catch {
    return null;
  }
}

export function BottomNav({
  initialUnread = 0,
  basePath = "",
  accentColor = "#7C5CFF",
  navSurfaceClass = "border-t border-black/[0.06] bg-[#FDFCF9]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[#FDFCF9]/90",
  badgeRingClass = "ring-[#FDFCF9]",
}: {
  initialUnread?: number;
  /** `""` for v1, `"/v2"` for the A/B variant shell. */
  basePath?: string;
  accentColor?: string;
  navSurfaceClass?: string;
  badgeRingClass?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = TAB_SUFFIXES.map((t) => ({
    ...t,
    href: `${basePath}${t.suffix}`,
  }));

  useEffect(() => {
    setServerUnreadBaseline(initialUnread);
  }, [initialUnread]);

  useEffect(() => {
    // Prefetch every bottom-nav tab so the first tap on any of them feels
    // instant — Next.js will load the RSC payload + JS chunks in the
    // background. Without this only `/messages` was warm and the others
    // had to fetch on first tap.
    for (const { suffix } of TAB_SUFFIXES) {
      router.prefetch(`${basePath}${suffix}`);
    }
    void warmInboxThreadsCache();
  }, [router, basePath]);

  /**
   * Keep the unread badge accurate on every page (not just /messages):
   *  - poll every 15 s while the tab is visible
   *  - refresh immediately when the tab regains focus / visibility
   *  - refresh on each route change
   */
  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const n = await fetchUnreadCount();
      if (cancelled || n === null) return;
      setServerUnreadBaseline(n);
    };

    refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 8000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);

    const onThreadsRefetch = () => void refresh();
    window.addEventListener(WHISPER_THREADS_REFETCH, onThreadsRefetch);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(WHISPER_THREADS_REFETCH, onThreadsRefetch);
    };
  }, [pathname]);

  const messagesBadge = useSyncExternalStore(
    subscribeMessagesTabBadge,
    getMessagesTabBadgeLabel,
    () => null,
  );
  const loggedIn = useSyncExternalStore(
    subscribeCredits,
    isPermanentCreditsUser,
    () => false,
  );

  if (!loggedIn || hideBottomNavOnPath(pathname)) {
    return null;
  }

  return (
    <nav className={`shrink-0 ${navSurfaceClass}`} aria-label="Hoofdnavigatie">
      <div
        className={`mx-auto flex w-full justify-between gap-0.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] ${APP_PAGE_PADDING_X}`}
      >
        {tabs.map(({ href, label, Icon, badge }) => {
          const active = isActive(pathname, href);
          const badgeLabel = href.endsWith("/messages") ? messagesBadge : badge;
          return (
            <Link
              key={href}
              href={href}
              className="flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-[10px] font-semibold leading-tight transition-colors active:opacity-80 sm:text-[11px]"
            >
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors sm:h-9 sm:w-9">
                <Icon
                  className="h-[20px] w-[20px] sm:h-[22px] sm:w-[22px]"
                  fill="none"
                  stroke={active ? accentColor : GRAY}
                  strokeWidth={active ? 2.4 : 2}
                />
                {badgeLabel && (
                  <span
                    className={`absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white shadow-sm ring-2 ${badgeRingClass} sm:h-[18px] sm:min-w-[18px] sm:text-[10px]`}
                  >
                    {badgeLabel}
                  </span>
                )}
              </span>
              <span className="flex max-w-full flex-col items-center px-0.5">
                <span
                  className={`max-w-full truncate ${
                    active ? "font-bold" : "font-medium text-gray-500"
                  }`}
                  style={active ? { color: accentColor } : undefined}
                >
                  {label}
                </span>
                {active && (
                  <span
                    className="mt-0.5 h-0.5 w-5 shrink-0 rounded-full"
                    style={{ backgroundColor: accentColor }}
                    aria-hidden
                  />
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
