"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChatBubbleIcon,
  ChevronLeftIcon,
  CameraIcon,
  UsersIcon,
} from "@/components/admin/icons";
import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  /** Match also when pathname startsWith href (so /admin/personas/new highlights Personas). */
  matchPrefix?: boolean;
};

const NAV: NavItem[] = [
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

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const active = item.matchPrefix
            ? pathname === item.href || pathname.startsWith(item.href + "/")
            : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
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

/** Compact mobile-only top-bar with the same nav. Hidden on lg+ where the
 * sidebar takes over. */
export function AdminMobileNav() {
  const pathname = usePathname() || "";
  return (
    <div className="border-b border-black/5 bg-white lg:hidden">
      <div className="flex h-14 items-center gap-3 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-primary text-xs font-bold text-white">
          w
        </div>
        <span className="text-sm font-semibold tracking-tight text-gray-900">whisper · admin</span>
        <nav className="ml-auto flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "rounded-lg px-2.5 py-1.5 text-xs font-medium " +
                  (active ? "bg-primary/10 text-primary" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
