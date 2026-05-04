"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DollarSign,
  Heart,
  MessageCircle,
  Search,
  User,
} from "lucide-react";

const tabs = [
  { href: "/", label: "Discover", Icon: Search, badge: null as string | null },
  {
    href: "/messages",
    label: "Messages",
    Icon: MessageCircle,
    badge: "3",
  },
  { href: "/likes", label: "Likes", Icon: Heart, badge: null },
  { href: "/credits", label: "Credits", Icon: DollarSign, badge: null },
  { href: "/me", label: "Me", Icon: User, badge: null },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="shrink-0 border-t border-black/[0.06] bg-[#FDFCF9]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[#FDFCF9]/90"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-[430px] justify-between gap-0.5 px-0.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {tabs.map(({ href, label, Icon, badge }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className="flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-[10px] font-semibold leading-tight transition-colors active:opacity-80 sm:text-[11px]"
            >
              <span
                className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors sm:h-9 sm:w-9 ${
                  active ? "text-primary" : "text-ink/40"
                }`}
              >
                <Icon
                  className="h-[20px] w-[20px] sm:h-[22px] sm:w-[22px]"
                  strokeWidth={active ? 2.25 : 2}
                />
                {badge && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-[#FDFCF9] sm:h-[18px] sm:min-w-[18px] sm:text-[10px]">
                    {badge}
                  </span>
                )}
              </span>
              <span
                className={`max-w-full truncate px-0.5 ${active ? "text-primary" : "text-ink/40"}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
