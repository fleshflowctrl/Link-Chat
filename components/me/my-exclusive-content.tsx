"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { contentSets, type ContentSet } from "@/data/exclusive-content";
import {
  getCreditsSnapshot,
  subscribeCredits,
} from "@/lib/credits-store";
import { readCachedUnlocks, writeCachedUnlocks } from "@/lib/unlocks/cache";

function CollectionRow({ set }: { set: ContentSet }) {
  return (
    <Link
      href="/links"
      className="flex items-center gap-3 px-4 py-3 transition-colors active:bg-black/[0.03]"
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5">
        <Image
          src={set.coverPhoto}
          alt={set.title}
          fill
          sizes="48px"
          className="object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-ink">{set.title}</p>
        <p className="truncate text-[11.5px] leading-snug text-gray-500">
          {set.creatorName} · {set.photos.length} foto
          {set.photos.length === 1 ? "" : "s"}
        </p>
      </div>
      <ChevronRight
        className="h-5 w-5 shrink-0 text-gray-300"
        strokeWidth={2}
        aria-hidden
      />
    </Link>
  );
}

/**
 * "Mijn collectie" — list of every exclusive-content set the signed-in user
 * has unlocked. Hydrates instantly from the per-user localStorage cache, then
 * re-syncs against `/api/me/unlocks` for freshness.
 *
 * Renders nothing if the user owns zero sets, so the section only appears
 * once they've actually bought something.
 */
export function MyExclusiveContent() {
  const credits = useSyncExternalStore(
    subscribeCredits,
    getCreditsSnapshot,
    getCreditsSnapshot,
  );
  const userKey = credits.userKey;

  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(() => new Set());

  // Hydrate from cache on mount + whenever the active user changes.
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

  const ownedSets = useMemo(
    () => contentSets.filter((s) => unlockedIds.has(s.id)),
    [unlockedIds],
  );

  if (ownedSets.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Mijn collectie
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
          <Sparkles className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          {ownedSets.length} ontgrendeld
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
        {ownedSets.map((set, i) => (
          <div
            key={set.id}
            className={i > 0 ? "border-t border-gray-100" : ""}
          >
            <CollectionRow set={set} />
          </div>
        ))}
      </div>
    </section>
  );
}
