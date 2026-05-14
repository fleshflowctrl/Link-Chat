"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { contentSets } from "@/data/exclusive-content";
import {
  getCreditsSnapshot,
  subscribeCredits,
} from "@/lib/credits-store";
import { readCachedUnlocks, writeCachedUnlocks } from "@/lib/unlocks/cache";

/**
 * "Mijn collectie" preview box on the `/me` page.
 *
 *  - Renders nothing if the user owns zero sets.
 *  - Otherwise shows a single tappable card with up to 3 stacked thumbnails,
 *    a count, and a chevron — tapping navigates to `/me/collection`, which
 *    contains the full grid + viewer.
 *
 *  Hydrates instantly from the per-user localStorage cache of unlocks, then
 *  re-syncs against `/api/me/unlocks`.
 */
export function MyExclusiveContent() {
  const credits = useSyncExternalStore(
    subscribeCredits,
    getCreditsSnapshot,
    getCreditsSnapshot,
  );
  const userKey = credits.userKey;

  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(() => new Set());

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

  const previews = ownedSets.slice(0, 3);
  const totalPhotos = ownedSets.reduce((sum, s) => sum + s.photos.length, 0);

  return (
    <section>
      <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
        Mijn collectie
      </h2>
      <Link
        href="/me/collection"
        className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/[0.04] transition active:scale-[0.99] active:bg-black/[0.02]"
      >
        {/* Stacked thumbnail collage */}
        <div className="relative h-14 w-[68px] shrink-0">
          {previews.map((set, i) => (
            <div
              key={set.id}
              className="absolute inset-y-0 h-14 w-12 overflow-hidden rounded-xl bg-gray-100 shadow-sm ring-2 ring-white"
              style={{
                left: `${i * 14}px`,
                zIndex: previews.length - i,
                transform: `rotate(${(i - 1) * 4}deg)`,
              }}
            >
              <Image
                src={set.coverPhoto}
                alt=""
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-ink">Mijn collectie</p>
          <p className="text-[11.5px] leading-snug text-gray-500">
            {ownedSets.length} set{ownedSets.length === 1 ? "" : "s"} ·{" "}
            {totalPhotos} foto{totalPhotos === 1 ? "" : "s"}
          </p>
        </div>

        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
          <Sparkles className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          {ownedSets.length}
        </span>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-gray-300"
          strokeWidth={2}
          aria-hidden
        />
      </Link>
    </section>
  );
}
