"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { StatusBarMock } from "@/components/messages/status-bar-mock";
import {
  formatLinkRequestSentLabel,
  initialLinkStats,
  seedLinkRequests,
  seedLinkedUsers,
  type LinkRequest,
  type LinkedUser,
} from "@/data/links";
import { meProfile } from "@/data/me";

export function LinksPageView() {
  const credits = meProfile.stats.credits.value;
  const [requests, setRequests] = useState<LinkRequest[]>(() => [...seedLinkRequests]);
  const [linked, setLinked] = useState<LinkedUser[]>(() => [...seedLinkedUsers]);
  const [stats, setStats] = useState(() => ({ ...initialLinkStats }));
  const [toast, setToast] = useState<string | null>(null);
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const newRequestCount = useMemo(
    () => requests.filter((r) => r.isNew).length,
    [requests],
  );

  useEffect(() => {
    return () => {
      if (clearRef.current) clearTimeout(clearRef.current);
    };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (clearRef.current) clearTimeout(clearRef.current);
    clearRef.current = setTimeout(() => setToast(null), 2600);
  };

  function acceptRequest(req: LinkRequest) {
    setRequests((prev) => prev.filter((r) => r.id !== req.id));
    setLinked((prev) => {
      if (prev.some((p) => p.id === req.id)) return prev;
      return [
        {
          id: req.id,
          name: req.name,
          photo: req.photo,
          isOnline: true,
        },
        ...prev,
      ];
    });
    setStats((s) => ({
      ...s,
      requestsReceived: Math.max(0, s.requestsReceived - 1),
      linkedCount: s.linkedCount + 1,
    }));
    showToast(`Gekoppeld met ${req.name} ✨`);
  }

  return (
    <div className="bg-[#F5F3EE] pb-6">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-24 left-1/2 z-[400] max-w-[min(90vw,360px)] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-center text-sm font-semibold text-white shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <StatusBarMock />

      <header className="flex items-start justify-between gap-3 px-5 pb-2 pt-1">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">
          Koppelingen
        </h1>
        <Link
          href="/credits"
          className="mt-1 inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white py-1.5 pl-2 pr-3 shadow-sm transition active:scale-95"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-[11px] font-bold text-white">
            $
          </span>
          <span className="text-[14px] font-bold text-gray-900">{credits}</span>
        </Link>
      </header>

      <div className="px-5 pb-4">
        <div className="flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
          <div className="flex flex-1 flex-col items-center justify-center py-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-pink-500">
              Verzoeken
            </span>
            <span className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
              {stats.requestsReceived}
            </span>
          </div>
          <div className="flex w-px shrink-0 items-center justify-center self-stretch py-3">
            <span className="h-10 w-px bg-gray-200" aria-hidden />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center py-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Gekoppeld
            </span>
            <span className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
              {stats.linkedCount}
            </span>
          </div>
          <div className="flex w-px shrink-0 items-center justify-center self-stretch py-3">
            <span className="h-10 w-px bg-gray-200" aria-hidden />
          </div>
          <div className="flex flex-1 flex-col items-center justify-center py-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Verstuurd
            </span>
            <span className="mt-1 text-2xl font-extrabold tabular-nums text-ink">
              {stats.sentCount}
            </span>
          </div>
        </div>
      </div>

      <section className="px-5 pb-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-bold text-ink">Wil met je koppelen</h2>
          {newRequestCount > 0 && (
            <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-semibold text-pink-600">
              {newRequestCount} nieuw
            </span>
          )}
        </div>

        <div className="space-y-2">
          {requests.map((req) => (
            <div
              key={req.id}
              className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/[0.04] transition active:scale-[0.98]"
            >
              <Link
                href={`/profile/${req.id}`}
                className="flex min-w-0 flex-1 items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F5F3EE]"
              >
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-lavender ring-1 ring-black/[0.06]">
                  <Image
                    src={req.photo}
                    alt=""
                    width={112}
                    height={112}
                    className="h-full w-full object-cover"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-ink">
                    {req.name}, {req.age}
                  </p>
                  <p className="truncate text-[11px] text-gray-500">{req.bio}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-pink-500">
                    {formatLinkRequestSentLabel(req.sentAt)}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  acceptRequest(req);
                }}
                className="shrink-0 rounded-full bg-[#7C5CFF] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition active:scale-95"
              >
                Koppel
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pb-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-[15px]" aria-hidden>
              🔗
            </span>
            <h2 className="text-[15px] font-bold text-ink">Jouw koppelingen</h2>
            <span className="rounded-full bg-[#EDE7FF] px-2 py-0.5 text-[10px] font-bold text-[#7C5CFF]">
              {linked.length}
            </span>
          </div>
          <Link
            href="/links/all"
            className="shrink-0 text-[13px] font-semibold text-primary transition active:opacity-70"
          >
            Alles tonen
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {linked.map((user, index) => (
            <Link
              key={`${user.id}-${index}`}
              href={`/profile/${user.id}`}
              className="relative aspect-square overflow-hidden rounded-xl bg-lavender shadow-sm ring-1 ring-black/[0.04] transition active:scale-[0.98]"
            >
              <Image
                src={user.photo}
                alt=""
                fill
                sizes="120px"
                className="object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <span className="pointer-events-none absolute bottom-1.5 left-1.5 right-1 truncate text-[10px] font-bold text-white drop-shadow">
                {user.name}
              </span>
              {user.isOnline && (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500 shadow-sm" />
              )}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
