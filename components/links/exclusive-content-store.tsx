"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Lock, MessageCircle, Sparkles, X } from "lucide-react";
import { CreditsPill } from "@/components/ui/credits-pill";
import {
  contentSets,
  type ContentSet,
} from "@/data/exclusive-content";
import {
  applyServerCreditsUpdate,
  getCreditsSnapshot,
  initCreditsStore,
  subscribeCredits,
} from "@/lib/credits-store";
import { readCachedUnlocks, writeCachedUnlocks } from "@/lib/unlocks/cache";
import { PhotoViewer } from "@/components/links/photo-viewer";

/* ─────────────────────────── helpers ────────────────────────────── */

function BlurredCover({ src, alt }: { src: string; alt: string }) {
  return (
    <div
      className="relative h-full w-full select-none overflow-hidden"
      role="img"
      aria-label={alt}
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/*
        Render as a CSS background instead of an <img>. iOS Safari long-press
        only offers "Save to Photos" / "Copy Subject" on real <img> elements,
        so backgrounds are safe from context-menu extraction. We also blur
        heavily and overscale so no real detail leaks through the edges.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(36px) saturate(1.05)",
          transform: "scale(1.25)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-black/35"
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
        <Lock className="h-6 w-6 text-white drop-shadow" strokeWidth={2.2} />
        <span className="text-[11px] font-bold text-white drop-shadow">
          Vergrendeld
        </span>
      </div>
    </div>
  );
}

/* ─────────────────── unlock confirmation sheet ───────────────────── */

function UnlockSheet({
  set,
  balance,
  onConfirm,
  onClose,
}: {
  set: ContentSet;
  balance: number;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const canAfford = balance >= set.credits;
  return (
    <motion.div
      key="unlock-sheet"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "tween", duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed inset-x-0 bottom-0 z-[200] mx-auto max-w-[430px] rounded-t-3xl bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl"
    >
      {/* drag handle */}
      <div className="mb-4 flex justify-center">
        <div className="h-1 w-10 rounded-full bg-gray-200" />
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition active:scale-95"
        aria-label="Sluiten"
      >
        <X className="h-4 w-4" strokeWidth={2.2} />
      </button>

      <div className="flex items-center gap-3">
        <span className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-black/[0.06]">
          <Image
            src={set.coverPhoto}
            alt=""
            fill
            className="object-cover"
            sizes="56px"
          />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#7C5CFF]">
            {set.creatorName} · {set.photos.length} foto&apos;s
          </p>
          <p className="truncate text-[16px] font-extrabold text-gray-900">
            {set.title}
          </p>
          <p className="mt-0.5 text-[12px] text-gray-500">{set.description}</p>
        </div>
      </div>

      <div className="my-4 flex items-center justify-between rounded-2xl bg-[#F5F3EE] px-4 py-3">
        <span className="text-[13px] font-semibold text-gray-600">Prijs</span>
        <span className="flex items-center gap-1.5 text-[16px] font-extrabold text-gray-900">
          <Sparkles className="h-4 w-4 text-[#7C5CFF]" strokeWidth={2} />
          {set.credits} credits
        </span>
      </div>

      <div className="mb-5 flex items-center justify-between text-[12px] text-gray-500">
        <span>Jouw saldo</span>
        <span className={`font-bold ${canAfford ? "text-gray-900" : "text-red-500"}`}>
          {balance} credits{!canAfford && " — te weinig"}
        </span>
      </div>

      {canAfford ? (
        <button
          type="button"
          onClick={onConfirm}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] py-3.5 text-[15px] font-extrabold text-white shadow-lg transition active:scale-[0.98]"
        >
          <Sparkles className="h-4 w-4" strokeWidth={2} />
          Ontgrendel voor {set.credits} credits
        </button>
      ) : (
        <button
          type="button"
          onClick={onClose}
          className="flex w-full items-center justify-center rounded-full border border-[#7C5CFF] py-3.5 text-[15px] font-bold text-[#7C5CFF] transition active:scale-[0.98]"
        >
          Koop meer credits
        </button>
      )}
    </motion.div>
  );
}

/* ─────────────────── card ───────────────────────────────────────── */

function ContentCard({
  set,
  isUnlocked,
  onTap,
}: {
  set: ContentSet;
  isUnlocked: boolean;
  onTap: (set: ContentSet) => void;
}) {
  return (
    <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-black/[0.05]">
      {/* tappable area */}
      <button
        type="button"
        onClick={() => onTap(set)}
        className="flex w-full flex-col text-left transition active:scale-[0.98]"
      >
        {/* cover */}
        <div className="relative aspect-[3/4] w-full overflow-hidden">
          {isUnlocked ? (
            <Image
              src={set.coverPhoto}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 430px) 45vw, 200px"
              quality={85}
            />
          ) : (
            <BlurredCover src={set.coverPhoto} alt={set.title} />
          )}

          {/* badges — alleen zichtbaar als nog niet ontgrendeld */}
          {!isUnlocked && (
            <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
              {set.isNew && (
                <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-white shadow-sm">
                  Nieuw
                </span>
              )}
              {set.isHot && (
                <span className="rounded-full bg-pink-500 px-2 py-0.5 text-[9px] font-bold text-white shadow-sm">
                  🔥 Hot
                </span>
              )}
            </div>
          )}

          {isUnlocked && (
            <div className="absolute left-1.5 top-1.5 rounded-full bg-[#7C5CFF] px-2 py-0.5 text-[9px] font-bold text-white shadow-sm">
              ✓ Ontgrendeld
            </div>
          )}

          <span className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
            🖼 {set.photos.length}
          </span>
        </div>

        {/* info */}
        <div className="p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full bg-gray-100">
              <Image src={set.creatorAvatar} alt="" fill className="object-cover" sizes="20px" />
            </span>
            <span className="truncate text-[11px] font-semibold text-gray-500">
              {set.creatorName}, {set.creatorAge}
            </span>
          </div>
          <p className="mt-1 truncate text-[13px] font-bold text-gray-900">{set.title}</p>
          {!isUnlocked && (
            <div className="mt-1.5 flex items-center gap-1 text-[12px] font-extrabold text-[#7C5CFF]">
              <Sparkles className="h-3 w-3 shrink-0" strokeWidth={2} />
              {set.credits} credits
            </div>
          )}
        </div>
      </button>

      {/* chat knop — alleen zichtbaar als ontgrendeld */}
      {isUnlocked && (
        <div className="px-2.5 pb-2.5">
          <Link
            href={`/messages/${set.creatorId}`}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#7C5CFF] py-1.5 text-[11px] font-bold text-white transition active:scale-95"
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
            Chat met {set.creatorName}
          </Link>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── main export ────────────────────────────────── */

export function ExclusiveContentStore() {
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(() => new Set());
  const [unlockTarget, setUnlockTarget] = useState<ContentSet | null>(null);
  const [viewTarget, setViewTarget] = useState<{
    set: ContentSet;
    index: number;
    justUnlocked?: boolean;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const credits = useSyncExternalStore(
    subscribeCredits,
    getCreditsSnapshot,
    getCreditsSnapshot,
  );
  const balance = credits.balance;
  const userKey = credits.userKey;

  /** Hydrate from per-user cache instantly, then re-sync with server. */
  useEffect(() => {
    initCreditsStore();
  }, []);

  useEffect(() => {
    if (!userKey) return;
    setUnlockedIds(new Set(readCachedUnlocks(userKey)));
    if (userKey === "guest") return;

    let cancelled = false;
    void fetch("/api/me/unlocks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; setIds?: string[] } | null) => {
        if (cancelled || !data?.ok || !Array.isArray(data.setIds)) return;
        setUnlockedIds(new Set(data.setIds));
        writeCachedUnlocks(userKey, data.setIds);
      })
      .catch(() => {
        /* keep cached state */
      });
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2800);
  }

  function handleCardTap(set: ContentSet) {
    if (unlockedIds.has(set.id)) {
      setViewTarget({ set, index: 0 });
    } else {
      setUnlockTarget(set);
    }
  }

  async function handleConfirmUnlock() {
    if (!unlockTarget || unlocking) return;
    if (userKey === "guest") {
      showToast("Log in om content te ontgrendelen");
      setUnlockTarget(null);
      return;
    }

    setUnlocking(true);
    try {
      const res = await fetch("/api/me/unlocks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ setId: unlockTarget.id }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        balance?: number;
        setIds?: string[];
        error?: string;
      };

      if (!res.ok || !data.ok) {
        if (res.status === 402) {
          showToast("Niet genoeg credits — laad meer op");
        } else {
          showToast(data.error ?? "Ontgrendelen mislukt");
        }
        return;
      }

      if (Array.isArray(data.setIds)) {
        setUnlockedIds(new Set(data.setIds));
        writeCachedUnlocks(userKey, data.setIds);
      }
      if (typeof data.balance === "number") {
        applyServerCreditsUpdate(data.balance);
      }
      showToast(`${unlockTarget.title} ontgrendeld ✨ — staat nu op je profiel`);
      const opened = unlockTarget;
      setUnlockTarget(null);
      setTimeout(
        () => setViewTarget({ set: opened, index: 0, justUnlocked: true }),
        250,
      );
    } catch {
      showToast("Netwerkfout — probeer opnieuw");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <section className="px-5 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      {/* page header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">
            Exclusief
          </h1>
          <p className="mt-0.5 text-[13px] text-gray-500">Ontgrendel met credits</p>
        </div>
        <CreditsPill />
      </div>

      {/* info: waar belandt aangekochte content? */}
      <Link
        href="/me"
        className="mb-4 flex items-center gap-2.5 rounded-2xl bg-[#F4EFFF] px-3.5 py-2.5 text-left ring-1 ring-[#7C5CFF]/15 transition active:scale-[0.99]"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#7C5CFF] ring-1 ring-[#7C5CFF]/20"
          aria-hidden
        >
          <Sparkles className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-bold text-ink">
            {unlockedIds.size > 0
              ? `Je collectie (${unlockedIds.size})`
              : "Aankopen op je profiel"}
          </span>
          <span className="block text-[11.5px] leading-tight text-gray-600">
            Gekochte content vind je terug onder &quot;Mijn collectie&quot;
          </span>
        </span>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[#7C5CFF]"
          strokeWidth={2.25}
          aria-hidden
        />
      </Link>

      {/* vergrendelde sets — ontgrendelde content staat op /me ("Mijn collectie") */}
      {contentSets.some((s) => !unlockedIds.has(s.id)) ? (
        <div className="grid grid-cols-2 gap-3">
          {contentSets
            .filter((s) => !unlockedIds.has(s.id))
            .map((set) => (
              <ContentCard
                key={set.id}
                set={set}
                isUnlocked={false}
                onTap={handleCardTap}
              />
            ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/[0.04]">
          <p className="text-[14px] font-bold text-ink">
            Je hebt alles ontgrendeld 🎉
          </p>
          <p className="mt-1 text-[12.5px] text-gray-500">
            Bekijk je collectie op je profiel onder &quot;Mijn collectie&quot;.
          </p>
        </div>
      )}

      {/* toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="pointer-events-none fixed bottom-24 left-1/2 z-[400] -translate-x-1/2 rounded-full bg-gray-900/90 px-5 py-3 text-center text-[13px] font-semibold text-white shadow-lg backdrop-blur-sm"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* unlock sheet backdrop */}
      <AnimatePresence>
        {unlockTarget && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[190] bg-black/40"
              onClick={() => setUnlockTarget(null)}
            />
            <UnlockSheet
              set={unlockTarget}
              balance={balance}
              onConfirm={handleConfirmUnlock}
              onClose={() => setUnlockTarget(null)}
            />
          </>
        )}
      </AnimatePresence>

      {/* photo viewer */}
      <AnimatePresence>
        {viewTarget && (
          <PhotoViewer
            set={viewTarget.set}
            startIndex={viewTarget.index}
            onClose={() => setViewTarget(null)}
            savedToCollectionHint={viewTarget.justUnlocked}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
