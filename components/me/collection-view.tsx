"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronLeft, Sparkles } from "lucide-react";
import { StatusBarMock } from "@/components/messages/status-bar-mock";
import { CreditsPill } from "@/components/ui/credits-pill";
import { contentSets, type ContentSet } from "@/data/exclusive-content";
import {
  getCreditsSnapshot,
  subscribeCredits,
} from "@/lib/credits-store";
import { WHISPER_UNLOCKS_REFETCH } from "@/lib/session-sync";
import { fetchUnlockSetIds } from "@/lib/unlocks/fetch-unlocks";
import { PhotoViewer } from "@/components/links/photo-viewer";

type ChatPhotoGroup = {
  peerId: string;
  name: string;
  avatarUrl: string;
  photos: Array<{ id: string; imageUrl: string; unlockedAt: string }>;
};

function CollectionCard({
  set,
  onOpen,
}: {
  set: ContentSet;
  onOpen: (set: ContentSet) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(set)}
      className="group flex w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-black/[0.05] transition active:scale-[0.98]"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        <Image
          src={set.coverPhoto}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 430px) 45vw, 200px"
          quality={85}
        />
        <span className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
          🖼 {set.photos.length}
        </span>
      </div>
      <div className="p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full bg-gray-100">
            <Image
              src={set.creatorAvatar}
              alt=""
              fill
              className="object-cover"
              sizes="20px"
            />
          </span>
          <span className="truncate text-[11px] font-semibold text-gray-500">
            {set.creatorName}, {set.creatorAge}
          </span>
        </div>
        <p className="mt-1 truncate text-[13px] font-bold text-gray-900">
          {set.title}
        </p>
      </div>
    </button>
  );
}

/**
 * Dedicated `/me/collection` page — grid of every exclusive-content set the
 * signed-in user has unlocked. Tapping a card opens the same full-screen
 * PhotoViewer used by `/links` after a fresh purchase.
 *
 * Loads unlocked sets from Supabase via `/api/me/unlocks`.
 */
export function CollectionView() {
  const credits = useSyncExternalStore(
    subscribeCredits,
    getCreditsSnapshot,
    getCreditsSnapshot,
  );
  const userKey = credits.userKey;

  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(() => new Set());
  const [chatPhotoGroups, setChatPhotoGroups] = useState<ChatPhotoGroup[]>([]);
  const [viewTarget, setViewTarget] = useState<{
    set: ContentSet;
    index: number;
  } | null>(null);
  // Convert a chat photo group into a ContentSet so we can reuse
  // the exact same card + PhotoViewer as the bought exclusive content.
  function chatGroupToContentSet(group: ChatPhotoGroup): ContentSet {
    const firstPhoto = group.photos[0]?.imageUrl || group.avatarUrl;
    return {
      id: `chat-${group.peerId}`,
      creatorId: group.peerId,
      creatorName: group.name,
      creatorAge: 0,
      creatorCity: "",
      creatorAvatar: group.avatarUrl,
      coverPhoto: firstPhoto,
      photos: group.photos.map((p) => p.imageUrl),
      title: `Chat met ${group.name}`,
      description: "Ontgrendelde foto's uit de chat",
      credits: 50,
      category: "exclusive",
      previewCount: 1,
    };
  }

  useEffect(() => {
    if (!userKey || userKey === "guest") {
      setUnlockedIds(new Set());
      return;
    }

    let cancelled = false;
    const load = () => {
      void fetchUnlockSetIds().then((ids) => {
        if (!cancelled) setUnlockedIds(new Set(ids));
      });
    };
    load();
    const onRefetch = () => load();
    window.addEventListener(WHISPER_UNLOCKS_REFETCH, onRefetch);
    return () => {
      cancelled = true;
      window.removeEventListener(WHISPER_UNLOCKS_REFETCH, onRefetch);
    };
  }, [userKey]);

  // Fetch unlocked chat photos (grouped by persona)
  useEffect(() => {
    if (!userKey || userKey === "guest") return;
    let cancelled = false;
    void fetch("/api/me/chat-photos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; groups?: ChatPhotoGroup[] } | null) => {
        if (cancelled || !data?.ok || !Array.isArray(data.groups)) return;
        setChatPhotoGroups(data.groups);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  const ownedSets = useMemo(
    () => contentSets.filter((s) => unlockedIds.has(s.id)),
    [unlockedIds],
  );

  // Merge bought exclusive content + chat-unlocked photos into one list
  const allSets = useMemo(() => {
    const chatSets = chatPhotoGroups.map(chatGroupToContentSet);
    return [...ownedSets, ...chatSets];
  }, [ownedSets, chatPhotoGroups]);

  return (
    <div className="bg-canvas pb-8">
      <StatusBarMock />

      <header className="flex items-center gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          href="/me"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/[0.05] transition active:scale-95"
          aria-label="Terug naar profiel"
        >
          <ChevronLeft className="h-5 w-5 text-ink" strokeWidth={2.25} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight text-ink">
            Mijn collectie
          </h1>
          <p className="text-[12px] text-gray-500">
            {allSets.length === 0
              ? "Nog niets ontgrendeld"
              : `${allSets.length} ontgrendelde set${allSets.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <CreditsPill />
      </header>

      <div className="px-5 pt-2">
        {allSets.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/[0.04]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F4EFFF] text-[#7C5CFF]">
              <Sparkles className="h-6 w-6" strokeWidth={2.25} aria-hidden />
            </div>
            <p className="text-[15px] font-bold text-ink">
              Nog geen content ontgrendeld
            </p>
            <p className="mx-auto mt-1.5 max-w-[260px] text-[12.5px] leading-relaxed text-gray-500">
              Ontgrendelde foto&apos;s uit chats en content die je koopt komen
              hier te staan.
            </p>
            <Link
              href="/discover"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-[#7C5CFF] px-5 py-2.5 text-[13px] font-bold text-white shadow-sm transition active:scale-[0.98]"
            >
              Ontdek mensen
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {allSets.map((set) => (
              <CollectionCard
                key={set.id}
                set={set}
                onOpen={(s) => setViewTarget({ set: s, index: 0 })}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {viewTarget && (
          <PhotoViewer
            set={viewTarget.set}
            startIndex={viewTarget.index}
            onClose={() => setViewTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
