"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useSyncExternalStore } from "react";
import {
  BadgeCheck,
  Bell,
  Camera,
  ChevronRight,
  CreditCard,
  Gift,
  HelpCircle,
  History,
  Lock,
  LogOut,
  Pencil,
  Settings,
  ShieldCheck,
  Crown,
} from "lucide-react";
import { meProfile, meSettingsRows, type MeSettingsIconKey } from "@/data/me";
import {
  getMeProfileSnapshot,
  subscribeMeProfile,
} from "@/lib/me-profile-store";

const settingsIcons: Record<
  MeSettingsIconKey,
  typeof ShieldCheck
> = {
  shield: ShieldCheck,
  lock: Lock,
  credit: CreditCard,
  history: History,
  gift: Gift,
  help: HelpCircle,
};

const statToneClass: Record<
  "purple" | "pink" | "yellow" | "green",
  string
> = {
  purple: "bg-primary/12 text-primary ring-1 ring-primary/15",
  pink: "bg-accentPink/12 text-accentPink ring-1 ring-accentPink/20",
  yellow: "bg-amber-100 text-amber-800 ring-1 ring-amber-200/80",
  green: "bg-accentGreen/12 text-emerald-800 ring-1 ring-accentGreen/25",
};

export function MeProfileView() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const live = useSyncExternalStore(
    subscribeMeProfile,
    getMeProfileSnapshot,
    getMeProfileSnapshot,
  );
  const bioParts = live.bio.split("\n");
  const bioLine1 = bioParts[0]?.trim() ?? "";
  const bioLine2 = bioParts.slice(1).join("\n").trim();

  function openPhotoPicker() {
    fileInputRef.current?.click();
  }

  function onPhotoSelected() {
    console.log("[me] Photo placeholder — no upload wired yet.");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onLogout() {
    if (
      typeof window !== "undefined" &&
      window.confirm("Log out of whisper?")
    ) {
      console.log("[me] Log out confirmed (placeholder).");
    }
  }

  const stats = Object.values(meProfile.stats);

  return (
    <>
      <div className="relative px-5 pt-3">
        <div className="pointer-events-none absolute right-5 top-2 flex gap-2">
          <button
            type="button"
            onClick={() => console.log("[me] Settings placeholder")}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-card ring-1 ring-black/[0.06] transition active:scale-95"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => console.log("[me] Notifications placeholder")}
            className="pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-card ring-1 ring-black/[0.06] transition active:scale-95"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" strokeWidth={2} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-white" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-hidden
          onChange={onPhotoSelected}
        />

        <div className="flex gap-4 pt-14">
          <div className="relative shrink-0">
            <div className="relative h-[180px] w-[180px] overflow-hidden rounded-full bg-lavender shadow-card ring-1 ring-black/[0.06]">
              <Image
                src={live.mainPhotoUrl}
                alt=""
                fill
                sizes="180px"
                className="object-cover"
                priority
                unoptimized={live.mainPhotoUrl.startsWith("blob:")}
              />
            </div>
            <button
              type="button"
              onClick={openPhotoPicker}
              className="absolute bottom-1 right-1 flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-lg ring-2 ring-canvas transition active:scale-95"
              aria-label="Change profile photo"
            >
              <Camera className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-1">
              <h1 className="text-[1.35rem] font-bold leading-tight text-ink">
                {live.firstName}
              </h1>
              {meProfile.verified && (
                <BadgeCheck
                  className="h-6 w-6 shrink-0 text-primary"
                  strokeWidth={2}
                  aria-label="Verified"
                />
              )}
            </div>
            <p className="mt-1 text-[14px] font-medium text-inkMuted">
              {live.age} · {live.location}
            </p>
            {bioLine1 && (
              <p className="mt-2 text-[13px] leading-snug text-ink">{bioLine1}</p>
            )}
            {bioLine2 && (
              <p className="mt-1 text-[13px] leading-snug text-ink">{bioLine2}</p>
            )}
            <Link
              href="/me/edit"
              className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary transition hover:underline"
            >
              <Pencil className="h-4 w-4" strokeWidth={2.25} />
              Edit profile
            </Link>
          </div>
        </div>
      </div>

      <div className="px-5 py-6">
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-white px-2 py-4 shadow-card ring-1 ring-black/[0.05]">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex min-w-0 flex-col items-center border-r border-black/[0.05] px-1 text-center last:border-r-0"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${statToneClass[s.tone]}`}
                aria-hidden
              >
                {s.emoji}
              </span>
              <p className="mt-2 text-lg font-bold tabular-nums text-ink">
                {s.value}
              </p>
              <p className="mt-0.5 text-[11px] font-bold text-ink">{s.label}</p>
              <p className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-tight text-inkMuted">
                {s.subtitle}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pb-6">
        <div className="flex items-center gap-3 rounded-2xl bg-lavender px-3.5 py-3.5 shadow-card ring-1 ring-primary/[0.08]">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-primary shadow-sm ring-1 ring-white/25">
            <Crown
              className="h-6 w-6 text-amber-300"
              strokeWidth={1.75}
              fill="currentColor"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-tight text-ink">
              Unlock more with Premium
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-inkMuted">
              See who linked you, read receipts, priority placement and more.
            </p>
          </div>
          <Link
            href="/credits"
            className="shrink-0 rounded-full bg-primary px-4 py-2.5 text-[13px] font-bold text-white shadow-pill transition active:scale-[0.98]"
          >
            Upgrade
          </Link>
        </div>
      </div>

      <div className="px-5 pb-6">
        <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.05]">
          {meSettingsRows.map((row, i) => {
            const Icon = settingsIcons[row.icon];
            return (
              <Link
                key={row.href}
                href={row.href}
                className={`flex min-h-[56px] items-center gap-3 px-4 py-3.5 transition-colors active:bg-black/[0.03] ${
                  i > 0 ? "border-t border-black/[0.06]" : ""
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lavender text-primary ring-1 ring-primary/10">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-ink">{row.title}</p>
                  <p className="text-[12px] leading-snug text-inkMuted">
                    {row.subtitle}
                  </p>
                </div>
                <ChevronRight
                  className="h-5 w-5 shrink-0 text-ink/25"
                  strokeWidth={2}
                />
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex justify-center px-5 pb-8">
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl px-4 py-2 text-[15px] font-semibold text-red-600 transition active:opacity-70"
        >
          <LogOut className="h-5 w-5" strokeWidth={2} />
          Log out
        </button>
      </div>
    </>
  );
}
