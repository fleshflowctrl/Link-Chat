"use client";

import Image from "next/image";
import { VariantLink as Link } from "@/components/variant-link";
import { useAppVariant } from "@/components/app-variant-provider";
import { withVariantPath } from "@/lib/app-variant";
import { withVariantPath } from "@/lib/app-variant";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  BadgeCheck,
  Link2,
  Mic,
  Pin,
} from "lucide-react";
import {
  sortThreadsByRecency,
  type MessageThread,
  type MessagePreviewType,
} from "@/data/messages";
import { hydrateClientSessionForUser } from "@/lib/client-user-session";
import {
  readInboxThreadsCache,
  writeInboxThreadsCache,
} from "@/lib/inbox-threads-cache";
import { WHISPER_THREADS_REFETCH } from "@/lib/session-sync";
import {
  getThreadPreviewsSnapshot,
  subscribeThreadPreviews,
} from "@/lib/thread-preview-store";
import { CreditsPill } from "@/components/ui/credits-pill";

function normalizeThread(t: MessageThread): MessageThread {
  return {
    ...t,
    lastActivityAt: t.lastActivityAt ?? "1970-01-01T00:00:00.000Z",
    messageType: t.messageType ?? "text",
    pinned: t.pinned ?? false,
    linkedPending: t.linkedPending ?? false,
  };
}

function mergePreview(
  t: MessageThread,
  lastMessage?: string,
  ts?: string,
  lastActivityAt?: string,
  unreadCount?: number,
): MessageThread {
  return {
    ...t,
    lastMessage: lastMessage ?? t.lastMessage,
    timestampLabel: ts ?? t.timestampLabel,
    lastActivityAt: lastActivityAt ?? t.lastActivityAt,
    unreadCount:
      unreadCount !== undefined ? unreadCount : t.unreadCount,
  };
}

function TypingDots() {
  return (
    <span className="ml-0.5 inline-flex items-end gap-0.5" aria-hidden>
      {[0, 120, 240].map((delay) => (
        <span
          key={delay}
          className="inline-block h-1 w-1 animate-bounce rounded-full bg-primary"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}


function PinnedSection({ threads }: { threads: MessageThread[] }) {
  const { variant } = useAppVariant();
  const isV2 = variant === "v2";
  if (threads.length === 0) return null;

  return (
    <section className="px-5 pb-4 pt-2">
      <div className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-inkMuted">
        <Pin className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} />
        <span>Vastgezet · {threads.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {threads.map((t) => (
          <Link
            key={t.id}
            href={withVariantPath(`/messages/${t.id}`, variant)}
            className={
              isV2
                ? "flex min-h-[72px] items-start gap-3 rounded-2xl border border-white/10 bg-[#2A2A2B] p-3 shadow-sm transition active:scale-[0.99]"
                : "flex min-h-[72px] items-start gap-3 rounded-2xl bg-gradient-to-br from-[#EDE7FF] to-[#FDE4F0] p-3 shadow-sm transition active:scale-[0.99]"
            }
          >
            <div className="relative shrink-0">
              <span
                className={
                  isV2
                    ? "relative block h-12 w-12 overflow-hidden rounded-full bg-[#353536] ring-1 ring-white/10"
                    : "relative block h-12 w-12 overflow-hidden rounded-full bg-white ring-1 ring-black/[0.06]"
                }
              >
                <Image
                  src={t.avatarUrl}
                  alt=""
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              </span>
              {t.showOnlineDot && (
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate text-[15px] font-bold text-ink">
                  {t.name}
                </span>
                {t.verified && (
                  <BadgeCheck
                    className="h-4 w-4 shrink-0 text-primary"
                    strokeWidth={2.25}
                    aria-label="Geverifieerd"
                  />
                )}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[13px] text-inkMuted">
                <Mic className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />
                <span>Spraakbericht · {t.voiceDuration ?? "0:24"}</span>
              </div>
            </div>
            <span className="shrink-0 pt-0.5 text-[10px] font-medium text-gray-500">
              {t.timestampLabel}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function effectivePreviewType(
  t: MessageThread,
  revealedLocked: Set<string>,
): MessagePreviewType {
  if (t.messageType === "locked" && revealedLocked.has(t.id)) {
    return t.previewImage ? "photo" : "text";
  }
  return t.messageType ?? "text";
}

function ConversationRow({
  thread: t,
  revealedLocked,
  onUnlock,
}: {
  thread: MessageThread;
  revealedLocked: Set<string>;
  onUnlock: (id: string) => void;
}) {
  const { variant } = useAppVariant();
  const mt = effectivePreviewType(t, revealedLocked);
  const locked = t.messageType === "locked" && !revealedLocked.has(t.id);
  const showOnline =
    t.showOnlineDot && !locked && mt !== "reaction";
  const timeTyping = mt === "typing";
  const unread = !locked && (t.unreadCount ?? 0) > 0;
  const previewClass = unread
    ? "min-w-0 flex-1 truncate text-[13px] font-semibold text-ink"
    : "min-w-0 flex-1 truncate text-[13px] text-inkMuted";

  const unreadBadge =
    t.unreadCount != null && t.unreadCount > 0 ? (
      <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#7C5CFF] px-1 text-[10px] font-bold text-white">
        {t.unreadCount > 9 ? "9+" : t.unreadCount}
      </span>
    ) : null;

  const mainColumn = (
    <div className="min-w-0 flex-1 pt-0.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <span
            className={`truncate text-[15px] font-bold ${
              locked ? "text-gray-500" : "text-ink"
            }`}
          >
            {locked ? "Iemand nieuw" : t.name}
          </span>
          {!locked && t.verified && (
            <BadgeCheck
              className="h-4 w-4 shrink-0 text-primary"
              strokeWidth={2.25}
              aria-label="Geverifieerd"
            />
          )}
        </div>
        <span
          className={`shrink-0 text-[10px] ${
            timeTyping
              ? "font-semibold text-primary"
              : unread
                ? "font-bold text-primary"
                : "font-medium text-gray-500"
          }`}
        >
          {t.timestampLabel}
        </span>
      </div>

      {mt === "typing" && (
        <p className="mt-0.5 text-[13px] font-semibold italic text-primary">
          typt
          <TypingDots />
        </p>
      )}

      {mt === "photo" && (
        <div className="mt-1 flex items-center gap-2">
          <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md bg-lavender ring-1 ring-black/[0.06]">
            {t.previewImage && (
              <Image
                src={t.previewImage}
                alt=""
                fill
                sizes="24px"
                className="object-cover"
              />
            )}
          </span>
          <span className={previewClass}>Stuurde een foto</span>
          {unreadBadge}
        </div>
      )}

      {mt === "voice" && (
        <div
          className={`mt-1 flex items-center gap-1.5 text-[13px] ${
            unread ? "font-semibold text-ink" : "text-inkMuted"
          }`}
        >
          <Mic className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />
          <span className="min-w-0 flex-1 truncate">
            Spraakbericht · {t.voiceDuration ?? "0:00"}
          </span>
          {unreadBadge}
        </div>
      )}

      {mt === "reaction" && (
        <p
          className={`mt-1 text-[13px] italic ${
            unread ? "font-semibold text-ink" : "text-gray-500"
          }`}
        >
          <span className="not-italic">{t.reactionEmoji ?? "❤️"}</span> reageerde op
          je bericht
        </p>
      )}

      {mt === "text" && (
        <div className="mt-1 flex items-start gap-2">
          <p className={previewClass}>{t.lastMessage}</p>
          {unreadBadge}
        </div>
      )}

      {locked && (
        <p className="mt-1 truncate text-[13px] italic text-gray-500">
          🔗 Koppel om hun bericht te zien
        </p>
      )}
    </div>
  );

  const avatar = (
    <div className="relative shrink-0">
      <span
        className={`relative block h-12 w-12 overflow-hidden rounded-full bg-lavender ring-1 ring-black/[0.06] ${
          locked ? "blur-[6px]" : ""
        }`}
      >
        <Image
          src={t.avatarUrl}
          alt=""
          width={96}
          height={96}
          className="h-full w-full object-cover"
        />
      </span>
      {showOnline && (
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
      )}
    </div>
  );

  if (locked) {
    return (
      <div className="flex min-h-[72px] items-start gap-3 bg-purple-50/50 px-4 py-3.5">
        {avatar}
        {mainColumn}
        <button
          type="button"
          onClick={() => onUnlock(t.id)}
          className="mt-0.5 flex h-9 shrink-0 items-center gap-1 self-center rounded-full bg-[#7C5CFF] px-3 text-[11px] font-bold text-white shadow-sm transition active:scale-95"
        >
          <Link2 className="h-3.5 w-3.5" strokeWidth={2.5} />
          Koppel
        </button>
      </div>
    );
  }

  return (
    <Link
      href={withVariantPath(`/messages/${t.id}`, variant)}
      className="flex min-h-[72px] items-start gap-3 px-4 py-3.5 transition-colors active:bg-black/[0.02]"
    >
      {avatar}
      {mainColumn}
    </Link>
  );
}

export function MessagesView() {
  const { variant } = useAppVariant();
  const [revealedLocked, setRevealedLocked] = useState<Set<string>>(() => new Set());
  const [serverThreads, setServerThreads] = useState<MessageThread[]>([]);
  const cacheHydratedRef = useRef(false);

  /** Paint cached inbox before first frame (avoids SSR empty → client flash). */
  useLayoutEffect(() => {
    if (cacheHydratedRef.current) return;
    cacheHydratedRef.current = true;
    const cached = readInboxThreadsCache();
    if (cached?.length) setServerThreads(cached);
  }, []);

  const applyThreads = useCallback((threads: MessageThread[]) => {
    setServerThreads(threads);
    if (threads.length > 0) writeInboxThreadsCache(threads);
  }, []);

  /** Background refresh — list renders from session cache immediately. */
  const loadThreads = useCallback(async () => {
    try {
      const r = await fetch("/api/me/threads", { cache: "no-store" });
      if (!r.ok) return;
      const json = (await r.json()) as {
        ok?: boolean;
        threads?: MessageThread[];
        userId?: string;
      };
      if (!json.ok) return;
      if (json.userId) {
        hydrateClientSessionForUser(json.userId);
      }
      applyThreads(json.threads ?? []);
    } catch {
      /* keep cached list */
    }
  }, [applyThreads]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    const onRefetch = () => void loadThreads();
    window.addEventListener(WHISPER_THREADS_REFETCH, onRefetch);
    return () => window.removeEventListener(WHISPER_THREADS_REFETCH, onRefetch);
  }, [loadThreads]);

  /**
   * Persist the inbox scroll position across navigations to a chat and back.
   * The scroll container is the <main> in the app layout. We save scrollTop
   * to sessionStorage on every scroll and restore it on mount.
   */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const main =
      (document.querySelector("main") as HTMLElement | null) ?? null;
    if (!main) return;

    const KEY = "messages:scroll-top";

    // Restore: try a couple of frames so layout (online rail, list) settles.
    const restore = () => {
      const raw = sessionStorage.getItem(KEY);
      if (!raw) return;
      const y = Number.parseInt(raw, 10);
      if (Number.isNaN(y) || y <= 0) return;
      main.scrollTop = y;
    };
    if (!restoredRef.current) {
      restoredRef.current = true;
      requestAnimationFrame(() => {
        restore();
        requestAnimationFrame(restore);
      });
    }

    const onScroll = () => {
      sessionStorage.setItem(KEY, String(main.scrollTop));
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  const source = serverThreads;
  const previews = useSyncExternalStore(
    subscribeThreadPreviews,
    getThreadPreviewsSnapshot,
    getThreadPreviewsSnapshot,
  );

  const normalized = useMemo(
    () => source.map(normalizeThread),
    [source],
  );

  const merged = useMemo(() => {
    const byId = new Map<string, MessageThread>();

    for (const t of normalized) {
      const o = previews.byId[t.id];
      const overrideUpToDate =
        o?.lastActivityAt &&
        t.lastActivityAt &&
        new Date(o.lastActivityAt).getTime() >
          new Date(t.lastActivityAt).getTime();

      byId.set(
        t.id,
        o && overrideUpToDate
          ? mergePreview(
              t,
              o.lastMessage,
              o.timestampLabel,
              o.lastActivityAt,
              o.unreadCount,
            )
          : t,
      );
    }

    return Array.from(byId.values());
  }, [normalized, previews.byId, previews.version]);

  const sorted = useMemo(() => sortThreadsByRecency(merged), [merged]);

  const pinnedThreads = useMemo(
    () => sorted.filter((t) => t.pinned),
    [sorted],
  );

  const unlock = (id: string) => {
    setRevealedLocked((prev) => new Set([...Array.from(prev), id]));
  };

  return (
    <div className="bg-canvas pb-6">
      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">
          Berichten
        </h1>
        <CreditsPill />
      </header>

      <PinnedSection threads={pinnedThreads} />

      <section className="pt-2">
        <div className="overflow-hidden border-y border-black/[0.06] bg-white shadow-sm">
          {sorted.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="text-[15px] font-semibold text-ink">
                Nog geen gesprekken
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-inkMuted">
                Open iemands profiel vanaf de startpagina en stuur een bericht —
                je chats verschijnen hier.
              </p>
              <Link
                href={withVariantPath("/discover", variant)}
                className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 py-2.5 text-[14px] font-bold text-white shadow-pill transition active:scale-[0.99]"
              >
                Profielen bekijken
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sorted.map((thread) => (
                <li key={thread.id}>
                  <ConversationRow
                    thread={thread}
                    revealedLocked={revealedLocked}
                    onUnlock={unlock}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
