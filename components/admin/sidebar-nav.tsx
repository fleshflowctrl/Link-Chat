"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ChartIcon,
  ChatBubbleIcon,
  ChevronLeftIcon,
  CameraIcon,
  MenuIcon,
  UsersIcon,
  XIcon,
} from "@/components/admin/icons";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /** Match also when pathname startsWith href (so /admin/personas/new highlights Personas). */
  matchPrefix?: boolean;
};

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/metrics", label: "Statistieken", icon: <ChartIcon />, matchPrefix: true },
  { href: "/admin/personas", label: "Personas", icon: <UsersIcon />, matchPrefix: true },
  { href: "/admin/messages", label: "Berichten", icon: <ChatBubbleIcon />, matchPrefix: true },
  {
    href: "/admin/scene-templates",
    label: "Templates",
    icon: <CameraIcon />,
    matchPrefix: true,
  },
  {
    href: "/admin/nudes",
    label: "Naaktfoto's",
    icon: <CameraIcon />,
    matchPrefix: true,
  },
];

function isNavActive(pathname: string, item: NavItem): boolean {
  return item.matchPrefix
    ? pathname === item.href || pathname.startsWith(item.href + "/")
    : pathname === item.href;
}

function AdminNavLinks({
  pathname,
  onNavigate,
  className = "",
}: {
  pathname: string;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <nav className={className}>
      {ADMIN_NAV.map((item) => {
        const active = isNavActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors " +
              (active
                ? "bg-gradient-to-r from-primary/10 to-primary/5 text-primary"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")
            }
          >
            <span
              className={
                active
                  ? "text-primary"
                  : "text-gray-400 group-hover:text-gray-700"
              }
            >
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminSidebarNav({ adminEmail }: { adminEmail: string | null }) {
  const pathname = usePathname() || "";

  return (
    <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-black/5 lg:bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-black/5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-primary text-sm font-bold text-white shadow-pill">
          w
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight text-gray-900">whisper</span>
          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400">admin</span>
        </div>
      </div>

      <AdminNavLinks
        pathname={pathname}
        className="flex-1 space-y-1 px-3 py-4"
      />

      <div className="border-t border-black/5 px-5 py-4">
        <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Ingelogd als
        </p>
        <p className="mt-0.5 truncate text-xs text-gray-700">
          {adminEmail ?? "admin"}
        </p>
        <Link
          href="/discover"
          className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Terug naar app
        </Link>
      </div>
    </aside>
  );
}

/** Mobile top bar with hamburger menu. Hidden on lg+ where the sidebar takes over. */
export function AdminMobileNav({ adminEmail }: { adminEmail?: string | null }) {
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <>
      <div className="border-b border-black/5 bg-white lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-primary text-xs font-bold text-white">
            w
          </div>
          <span className="min-w-0 truncate text-sm font-semibold tracking-tight text-gray-900">
            whisper · admin
          </span>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-700 transition-colors hover:bg-gray-100"
            aria-expanded={open}
            aria-controls="admin-mobile-menu"
            aria-label={open ? "Menu sluiten" : "Menu openen"}
          >
            {open ? (
              <XIcon className="h-5 w-5" />
            ) : (
              <MenuIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Menu sluiten"
            onClick={close}
          />
          <aside
            id="admin-mobile-menu"
            className="absolute right-0 top-0 flex h-full w-[min(100%,18rem)] flex-col border-l border-black/5 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigatie"
          >
            <div className="flex h-14 items-center justify-between border-b border-black/5 px-4">
              <span className="text-sm font-semibold text-gray-900">Menu</span>
              <button
                type="button"
                onClick={close}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100"
                aria-label="Menu sluiten"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <AdminNavLinks
              pathname={pathname}
              onNavigate={close}
              className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
            />

            <div className="border-t border-black/5 px-4 py-4">
              {adminEmail ? (
                <p className="mb-3 truncate text-xs text-gray-500">
                  {adminEmail}
                </p>
              ) : null}
              <Link
                href="/discover"
                onClick={close}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                <ChevronLeftIcon className="h-4 w-4" />
                Terug naar app
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
