"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useSyncExternalStore } from "react";
import {
  BadgeCheck,
  Camera,
  ChevronRight,
  CreditCard,
  Gift,
  HelpCircle,
  History,
  Lock,
  LogOut,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { StatusBarMock } from "@/components/messages/status-bar-mock";
import {
  meProfile,
  meSettingsSections,
  meStatGridOrder,
  type MeSettingsIconKey,
  type MeStatKey,
} from "@/data/me";
import {
  getMeProfileSnapshot,
  subscribeMeProfile,
} from "@/lib/me-profile-store";

const settingsIcons: Record<MeSettingsIconKey, typeof ShieldCheck> = {
  shield: ShieldCheck,
  lock: Lock,
  credit: CreditCard,
  history: History,
  gift: Gift,
  help: HelpCircle,
};

export function MeProfileView() {
  const router = useRouter();
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
      router.push("/");
    }
  }

  const credits = meProfile.stats.credits.value;

  return (
    <div className="bg-[#F5F3EE] pb-8">
      <StatusBarMock />

      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-1">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">
          Profile
        </h1>
        <div className="mt-0.5 flex shrink-0 items-center gap-2">
          <Link
            href="/credits"
            className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white py-1.5 pl-2 pr-3 shadow-sm transition active:scale-95"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-[11px] font-bold text-white">
              $
            </span>
            <span className="text-[14px] font-bold text-gray-900">{credits}</span>
          </Link>
          <Link
            href="/me/settings"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-600 shadow-sm transition active:scale-95"
            aria-label="Settings"
          >
            <Settings className="h-[18px] w-[18px]" strokeWidth={2} />
          </Link>
        </div>
      </header>

      <div className="px-5 pb-5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-hidden
          onChange={onPhotoSelected}
        />

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#7C5CFF] to-[#9B7BFF] p-5 text-white shadow-md">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-white/10"
            aria-hidden
          />

          <div className="relative flex gap-4">
            <div className="relative shrink-0">
              <div className="relative h-20 w-20 overflow-hidden rounded-full bg-white/20 ring-4 ring-white/30">
                <Image
                  src={live.mainPhotoUrl}
                  alt=""
                  fill
                  sizes="80px"
                  className="object-cover"
                  priority
                  unoptimized={live.mainPhotoUrl.startsWith("blob:")}
                />
              </div>
              <button
                type="button"
                onClick={openPhotoPicker}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-md ring-2 ring-white/40 transition active:scale-95"
                aria-label="Change profile photo"
              >
                <Camera className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-2xl font-bold leading-tight">
                  {live.firstName}
                </span>
                {meProfile.verified && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/95 text-primary shadow-sm ring-1 ring-white/50">
                    <BadgeCheck className="h-4 w-4" strokeWidth={2.5} aria-label="Verified" />
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-white/90">
                {live.age} · {live.location}
              </p>
              {bioLine1 && (
                <p className="mt-1 text-xs text-white/90">{bioLine1}</p>
              )}
              {bioLine2 && (
                <p className="mt-0.5 text-xs text-white/90">{bioLine2}</p>
              )}
              <Link
                href="/me/edit"
                className="mt-3 inline-block rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary shadow-sm transition active:scale-[0.98]"
              >
                Edit profile
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-5 pb-6">
        {meStatGridOrder.map((key) => {
          const s = meProfile.stats[key as MeStatKey];
          return (
            <div
              key={key}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/[0.04]"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${s.cardBg}`}
                aria-hidden
              >
                {s.emoji}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  {s.label}
                </p>
                <p className="text-lg font-extrabold tabular-nums text-ink">
                  {s.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-6 px-5 pb-6">
        {meSettingsSections.map((section) => (
          <section key={section.label}>
            <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {section.label}
            </h2>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
              {section.rows.map((row, i) => {
                const Icon = settingsIcons[row.icon];
                return (
                  <Link
                    key={row.href}
                    href={row.href}
                    className={`flex min-h-[56px] items-center gap-3 px-4 py-3.5 transition-colors active:bg-black/[0.03] ${
                      i > 0 ? "border-t border-gray-100" : ""
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDE7FF] text-primary ring-1 ring-primary/10">
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-ink">{row.title}</p>
                      <p className="text-[12px] leading-snug text-gray-500">
                        {row.subtitle}
                      </p>
                    </div>
                    {row.bonusPill && (
                      <span className="shrink-0 rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-600">
                        {row.bonusPill}
                      </span>
                    )}
                    <ChevronRight
                      className="h-5 w-5 shrink-0 text-gray-300"
                      strokeWidth={2}
                    />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="flex justify-center px-5 pb-8">
        <button
          type="button"
          onClick={onLogout}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-red-600 transition active:opacity-70"
        >
          <LogOut className="h-5 w-5" strokeWidth={2} />
          Log out
        </button>
      </div>
    </div>
  );
}
