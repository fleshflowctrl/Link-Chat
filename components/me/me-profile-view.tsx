"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Camera,
  ChevronRight,
  CreditCard,
  Gift,
  HelpCircle,
  History,
  Lock,
  Settings,
  ShieldCheck,
  User,
} from "lucide-react";
import { StatusBarMock } from "@/components/messages/status-bar-mock";
import { SignOutButton } from "@/components/me/sign-out-button";
import {
  meSettingsSections,
  meStatCardLayout,
  meStatGridOrder,
  type MeSettingsIconKey,
  type MeStatKey,
} from "@/data/me";
import {
  FUNNEL_SESSION_KEY,
  ONBOARDED_KEY,
  WHISPER_USER_KEY,
} from "@/data/funnel";
import type { EditProfileState } from "@/data/me-edit";
import { uploadProfileImage } from "@/lib/me/client-storage-upload";
import type { MeProfileStats } from "@/lib/me/server-profile";
import {
  getMeProfileSnapshot,
  setMeProfileSnapshot,
  subscribeMeProfile,
} from "@/lib/me-profile-store";
import { CreditsPill } from "@/components/ui/credits-pill";
import {
  getCreditsSnapshot,
  subscribeCredits,
} from "@/lib/credits-store";

const settingsIcons: Record<MeSettingsIconKey, typeof ShieldCheck> = {
  shield: ShieldCheck,
  lock: Lock,
  credit: CreditCard,
  history: History,
  gift: Gift,
  help: HelpCircle,
};

function formatAgeLocation(age: number | null, location: string): string | null {
  const loc = location.trim();
  const parts: string[] = [];
  if (age != null) parts.push(String(age));
  if (loc) parts.push(loc);
  return parts.length ? parts.join(" · ") : null;
}

type MeProfileViewProps = {
  initialProfile: EditProfileState;
  syncToken: string;
  credits?: number;
  stats: MeProfileStats;
  showVerified: boolean;
};

export function MeProfileView({
  initialProfile,
  syncToken,
  stats,
  showVerified,
}: MeProfileViewProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const credits = useSyncExternalStore(subscribeCredits, getCreditsSnapshot, getCreditsSnapshot).balance;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    setMeProfileSnapshot(initialProfile);
  }, [syncToken, initialProfile]);

  const live = useSyncExternalStore(
    subscribeMeProfile,
    getMeProfileSnapshot,
    getMeProfileSnapshot,
  );
  const bioParts = live.bio.split("\n");
  const bioLine1 = bioParts[0]?.trim() ?? "";
  const bioLine2 = bioParts.slice(1).join("\n").trim();
  const hasPhoto = live.mainPhotoUrl.trim().length > 0;
  const displayName = live.firstName.trim() || "Jouw profiel";
  const ageLoc = formatAgeLocation(live.age, live.location);

  function openPhotoPicker() {
    fileInputRef.current?.click();
  }

  async function onPhotoSelected() {
    const input = fileInputRef.current;
    const f = input?.files?.[0];
    if (input) input.value = "";
    if (!f || photoBusy) return;

    setPhotoBusy(true);
    try {
      const r = await uploadProfileImage(f);
      if (!r.ok) {
        showToast(r.error);
        return;
      }
      const snap = getMeProfileSnapshot();
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...snap, mainPhotoUrl: r.publicUrl }),
        credentials: "same-origin",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        showToast(err.error ?? "Foto opslaan mislukt");
        return;
      }
      const data = (await res.json()) as { profile: EditProfileState };
      setMeProfileSnapshot(data.profile);
      showToast("Profielfoto bijgewerkt");
      router.refresh();
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <div className="bg-[#F5F3EE] pb-8">
      <StatusBarMock />

      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">
          Profiel
        </h1>
        <CreditsPill />
      </header>

      <div className="px-5 pb-5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-hidden
          onChange={() => void onPhotoSelected()}
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
                {hasPhoto ? (
                  <Image
                    src={live.mainPhotoUrl}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                    priority
                    unoptimized={live.mainPhotoUrl.startsWith("blob:")}
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center bg-white/15 text-white/90"
                    aria-hidden
                  >
                    <User className="h-9 w-9" strokeWidth={1.75} />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={openPhotoPicker}
                disabled={photoBusy}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary shadow-md ring-2 ring-white/40 transition enabled:active:scale-95 disabled:opacity-50"
                aria-label="Profielfoto wijzigen"
              >
                <Camera className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </div>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-2xl font-bold leading-tight">
                  {displayName}
                </span>
                {showVerified && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/95 text-primary shadow-sm ring-1 ring-white/50">
                    <BadgeCheck className="h-4 w-4" strokeWidth={2.5} aria-label="Geverifieerd" />
                  </span>
                )}
              </div>
              {ageLoc ? (
                <p className="mt-1 text-xs text-white/90">{ageLoc}</p>
              ) : (
                <p className="mt-1 text-xs text-white/75">
                  Voeg leeftijd &amp; locatie toe bij bewerken
                </p>
              )}
              {bioLine1 && (
                <p className="mt-1 text-xs text-white/90">{bioLine1}</p>
              )}
              {bioLine2 && (
                <p className="mt-0.5 text-xs text-white/90">{bioLine2}</p>
              )}
              {!bioLine1 && !bioLine2 && (
                <p className="mt-1 text-xs text-white/75">
                  Voeg een korte bio toe bij bewerken — vertel waar je van houdt.
                </p>
              )}
              <Link
                href="/me/edit"
                className="mt-3 inline-block rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary shadow-sm transition active:scale-[0.98]"
              >
                Profiel bewerken
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 px-5 pb-6">
        {meStatGridOrder.map((key) => {
          const layout = meStatCardLayout[key as MeStatKey];
          const value = key === "credits" ? credits : stats.chats;
          return (
            <div
              key={key}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/[0.04]"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${layout.cardBg}`}
                aria-hidden
              >
                {layout.emoji}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  {layout.label}
                </p>
                <p className="text-lg font-extrabold tabular-nums text-ink">
                  {value}
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

      <div className="px-5 pb-3">
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem(ONBOARDED_KEY);
              localStorage.removeItem(WHISPER_USER_KEY);
              sessionStorage.removeItem(FUNNEL_SESSION_KEY);
            } catch {
              /* ignore */
            }
            router.push("/?testFunnel=1");
          }}
          className="flex w-full items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white/90 py-3 text-[13px] font-semibold text-gray-600 shadow-sm transition active:scale-95"
        >
          Test onboarding funnel
        </button>
      </div>

      <div className="flex justify-center px-5 pb-8">
        <SignOutButton />
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-24 left-1/2 z-[400] max-w-[min(90vw,360px)] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-center text-sm font-semibold text-white shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
