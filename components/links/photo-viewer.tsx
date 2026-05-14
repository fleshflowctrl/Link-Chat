"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Check, MessageCircle, X } from "lucide-react";
import type { ContentSet } from "@/data/exclusive-content";

/**
 * Full-screen photo viewer for an unlocked exclusive-content set.
 * Used both by `/links` (after unlock or on tap of an owned card) and by
 * `/me` ("Mijn collectie" rows).
 */
export function PhotoViewer({
  set,
  startIndex,
  onClose,
  /** When true, shows a "Opgeslagen in Mijn collectie" pill at the top —
   *  use right after a fresh purchase so the user immediately knows where
   *  their content lives from now on. */
  savedToCollectionHint = false,
}: {
  set: ContentSet;
  startIndex: number;
  onClose: () => void;
  savedToCollectionHint?: boolean;
}) {
  const [idx, setIdx] = useState(startIndex);

  return (
    <motion.div
      key="viewer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[300] flex flex-col bg-black"
    >
      <div className="flex shrink-0 items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <span className="text-[13px] font-semibold text-white/70">
          {idx + 1} / {set.photos.length}
        </span>
        <div className="flex items-center gap-2">
          <Link
            href={`/messages/${set.creatorId}`}
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-full bg-[#7C5CFF] px-3 py-1.5 text-[12px] font-bold text-white transition active:scale-95"
          >
            <MessageCircle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
            Chat
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition active:scale-95"
            aria-label="Sluiten"
          >
            <X className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Image
          key={idx}
          src={set.photos[idx] ?? set.photos[0]}
          alt=""
          fill
          className="object-contain"
          sizes="430px"
          quality={95}
        />

        {savedToCollectionHint && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-emerald-500/95 px-3 py-1.5 text-[11.5px] font-bold text-white shadow-lg backdrop-blur-sm"
          >
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
              Opgeslagen in Mijn collectie
            </span>
          </motion.div>
        )}
      </div>

      <div className="absolute inset-y-[10%] left-0 w-1/2" onClick={() => setIdx((i) => Math.max(0, i - 1))} />
      <div className="absolute inset-y-[10%] right-0 w-1/2" onClick={() => setIdx((i) => Math.min(set.photos.length - 1, i + 1))} />

      <div className="shrink-0 flex gap-1.5 overflow-x-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 [-webkit-overflow-scrolling:touch]">
        {set.photos.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl transition active:scale-95 ${
              i === idx ? "ring-2 ring-[#7C5CFF] ring-offset-2 ring-offset-black" : "opacity-60"
            }`}
          >
            <Image src={p} alt="" fill className="object-cover" sizes="56px" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
