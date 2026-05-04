"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BadgeCheck,
  Heart,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import {
  buildPeopleYouLiked,
  likesStats,
  mutualLinks,
  type LikedPerson,
  type MutualLink,
} from "@/data/likes";

type Tab = "links" | "liked";

export function LikesPageView() {
  const [tab, setTab] = useState<Tab>("links");
  const [likedPeople, setLikedPeople] = useState<LikedPerson[]>(() =>
    buildPeopleYouLiked(),
  );

  const newLinks = useMemo(
    () => mutualLinks.filter((m) => !m.hasStartedChat),
    [],
  );
  const conversations = useMemo(
    () => mutualLinks.filter((m) => m.hasStartedChat),
    [],
  );
  const newLinkCount = newLinks.length;

  function unlike(person: LikedPerson) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Remove ${person.name} from people you liked?`)
    ) {
      return;
    }
    setLikedPeople((prev) => prev.filter((p) => p.key !== person.key));
  }

  return (
    <div className="pb-2">
      <header className="px-5 pb-3 pt-3">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Likes</h1>
      </header>

      <div className="grid grid-cols-2 gap-3 px-5 pb-5">
        <div className="rounded-2xl bg-accentPink/12 px-4 py-4 shadow-card ring-1 ring-accentPink/20">
          <span className="text-2xl" aria-hidden>
            ❤️
          </span>
          <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
            {likesStats.peopleYouLiked}
          </p>
          <p className="mt-1 text-[12px] font-semibold leading-snug text-inkMuted">
            People try to link
          </p>
        </div>
        <div className="rounded-2xl bg-lavender px-4 py-4 shadow-card ring-1 ring-primary/15">
          <Sparkles className="mt-0.5 h-7 w-7 text-primary" strokeWidth={2} />
          <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
            {likesStats.mutualLinks}
          </p>
          <p className="mt-1 text-[12px] font-semibold leading-snug text-inkMuted">
            Your links
          </p>
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="flex rounded-full bg-black/[0.06] p-1.5">
          <button
            type="button"
            onClick={() => setTab("links")}
            className="relative flex-1 rounded-full py-2.5 text-center"
          >
            {tab === "links" && (
              <motion.div
                layoutId="likesTabPill"
                className="absolute inset-0 rounded-full bg-primary shadow-md"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <span
              className={`relative z-10 text-[14px] font-bold ${
                tab === "links" ? "text-white" : "text-ink/45"
              }`}
            >
              Links
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("liked")}
            className="relative flex-1 rounded-full py-2.5 text-center"
          >
            {tab === "liked" && (
              <motion.div
                layoutId="likesTabPill"
                className="absolute inset-0 rounded-full bg-primary shadow-md"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <span
              className={`relative z-10 text-[14px] font-bold ${
                tab === "liked" ? "text-white" : "text-ink/45"
              }`}
            >
              You liked
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === "links" ? (
          <motion.div
            key="links"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="px-5 pb-6"
          >
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-bold text-ink">New links</h2>
              <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-bold text-primary ring-1 ring-primary/20">
                {newLinkCount}
              </span>
            </div>
            <div className="scrollbar-hide -mx-1 flex gap-3 overflow-x-auto pb-4">
              {newLinks.map((m, idx) => (
                <LinkRailCard key={`new-${idx}`} m={m} />
              ))}
            </div>

            <h2 className="mb-3 text-lg font-bold text-ink">Conversations</h2>
            <ul className="flex flex-col gap-0 divide-y divide-black/[0.06] overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.05]">
              {conversations.map((m, idx) => (
                <li key={`conv-${m.profileId}-${idx}`}>
                  <div className="flex min-h-[72px] items-center gap-3 px-4 py-3">
                    <Link
                      href={`/profile/${m.profileId}`}
                      className="relative shrink-0"
                    >
                      <span className="block h-14 w-14 overflow-hidden rounded-full bg-lavender ring-1 ring-black/[0.06]">
                        <Image
                          src={m.imageUrl}
                          alt=""
                          width={112}
                          height={112}
                          className="h-full w-full object-cover"
                        />
                      </span>
                      {m.online && (
                        <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-[2.5px] border-white bg-accentGreen" />
                      )}
                    </Link>
                    <Link
                      href={`/profile/${m.profileId}`}
                      className="min-w-0 flex-1"
                    >
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-ink">{m.name}</span>
                        {m.verified && (
                          <BadgeCheck
                            className="h-4 w-4 shrink-0 text-primary"
                            strokeWidth={2.5}
                          />
                        )}
                      </div>
                      <p className="text-[13px] text-inkMuted">{m.linkedLabel}</p>
                    </Link>
                    <Link
                      href={`/messages/${m.profileId}`}
                      className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-[12px] font-bold text-white shadow-sm transition active:scale-95"
                    >
                      <MessageCircle className="h-4 w-4" strokeWidth={2.25} />
                      Chat
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : (
          <motion.div
            key="liked"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="px-5 pb-6"
          >
            {likedPeople.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white px-6 py-16 text-center shadow-card ring-1 ring-black/[0.05]">
                <span className="text-5xl" aria-hidden>
                  💜
                </span>
                <p className="text-lg font-bold text-ink">No likes yet</p>
                <p className="max-w-xs text-sm text-inkMuted">
                  Start exploring on Discover
                </p>
                <Link
                  href="/"
                  className="mt-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-pill"
                >
                  Go to Discover
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5">
                {likedPeople.map((person) => (
                  <LikedGridCard
                    key={person.key}
                    person={person}
                    onUnlike={() => unlike(person)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LinkRailCard({ m }: { m: MutualLink }) {
  return (
    <Link
      href={`/profile/${m.profileId}`}
      className="relative block h-[200px] w-[140px] shrink-0 overflow-hidden rounded-2xl bg-ink/10 shadow-card ring-1 ring-black/[0.06]"
    >
      <Image
        src={m.imageUrl}
        alt=""
        fill
        sizes="140px"
        className="object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
      {m.newPill && (
        <span className="absolute left-2 top-2 rounded-full bg-accentPink px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
          New ✨
        </span>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-[15px] font-bold text-white drop-shadow">
          {m.name}, {m.age}
        </p>
      </div>
    </Link>
  );
}

function LikedGridCard({
  person,
  onUnlike,
}: {
  person: LikedPerson;
  onUnlike: () => void;
}) {
  const chip =
    person.status === "linked" ? (
      <span className="inline-flex max-w-[calc(100%-2rem)] items-center gap-1 rounded-full bg-accentPink/20 px-2 py-1 text-[9px] font-bold leading-tight text-accentPink ring-1 ring-accentPink/30">
        <Heart className="h-2.5 w-2.5 fill-accentPink" strokeWidth={0} />
        Linked
      </span>
    ) : (
      <span className="rounded-full bg-white/55 px-2 py-1 text-[9px] font-bold text-inkMuted ring-1 ring-black/5 backdrop-blur-sm">
        Pending
      </span>
    );

  return (
    <div className="relative aspect-[3/4.1] w-full overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.04]">
      <Link href={`/profile/${person.profileId}`} className="absolute inset-0 z-0">
        <Image
          src={person.imageUrl}
          alt={`${person.name}, ${person.age}`}
          fill
          sizes="(max-width: 430px) 50vw, 200px"
          className="object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      </Link>
      <div className="pointer-events-none absolute left-3 top-3 z-10">{chip}</div>
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 p-3 pr-14">
        <p className="text-lg font-bold text-white drop-shadow-sm">
          {person.name}, {person.age}
        </p>
      </div>
      <motion.button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onUnlike();
        }}
        className="absolute bottom-3 right-3 z-20 flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/70 bg-white/95 text-primary shadow-lg"
        aria-label="Unlike"
        whileTap={{ scale: 0.88 }}
      >
        <Heart className="h-5 w-5 fill-primary text-primary" strokeWidth={2} />
      </motion.button>
    </div>
  );
}
