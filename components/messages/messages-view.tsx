"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  BadgeCheck,
  Bell,
  Link2,
  Mic,
  Pin,
} from "lucide-react";
import { OnlineNowRail } from "@/components/OnlineNowRail";
import {
  getThreadMeta,
  sortThreadsByRecency,
  type MessageThread,
  type MessagePreviewType,
} from "@/data/messages";
import { homeUnreadNotificationCount } from "@/data/me";
import type { OnlineUser } from "@/data/onlineUsers";
import {
  getThreadPreviewsSnapshot,
  subscribeThreadPreviews,
} from "@/lib/thread-preview-store";
import { StatusBarMock } from "./status-bar-mock";

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
): MessageThread {
  return {
    ...t,
    lastMessage: lastMessage ?? t.lastMessage,
    timestampLabel: ts ?? t.timestampLabel,
    lastActivityAt: lastActivityAt ?? t.lastActivityAt,
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

function MessagesHeaderActions({ credits }: { credits: number }) {
  const unread = homeUnreadNotificationCount;

  return (
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
        href="/notifications"
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-500 shadow-sm transition active:scale-95"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#7C5CFF] px-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-[#F5F3EE]">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    </div>
  );
}

function PinnedSection({ threads }: { threads: MessageThread[] }) {
  if (threads.length === 0) return null;

  return (
    <section className="px-5 pb-4 pt-2">
      <div className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
        <Pin className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2.5} />
        <span>Pinned · {threads.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {threads.map((t) => (
          <Link
            key={t.id}
            href={`/messages/${t.id}`}
            className="flex min-h-[72px] items-start gap-3 rounded-2xl bg-gradient-to-br from-[#EDE7FF] to-[#FDE4F0] p-3 shadow-sm transition active:scale-[0.99]"
          >
            <div className="relative shrink-0">
              <span className="relative block h-12 w-12 overflow-hidden rounded-full bg-white ring-1 ring-black/[0.06]">
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
                    aria-label="Verified"
                  />
                )}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[13px] text-inkMuted">
                <Mic className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />
                <span>Voice message · {t.voiceDuration ?? "0:24"}</span>
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
  const mt = effectivePreviewType(t, revealedLocked);
  const locked = t.messageType === "locked" && !revealedLocked.has(t.id);
  const showOnline =
    t.showOnlineDot && !locked && mt !== "reaction";
  const timeTyping = mt === "typing";

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
            {locked ? "Someone new" : t.name}
          </span>
          {!locked && t.verified && (
            <BadgeCheck
              className="h-4 w-4 shrink-0 text-primary"
              strokeWidth={2.25}
              aria-label="Verified"
            />
          )}
        </div>
        <span
          className={`shrink-0 text-[10px] font-medium ${
            timeTyping ? "font-semibold text-primary" : "text-gray-500"
          }`}
        >
          {t.timestampLabel}
        </span>
      </div>

      {mt === "typing" && (
        <p className="mt-0.5 text-[13px] font-semibold italic text-primary">
          typing
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
          <span className="min-w-0 flex-1 truncate text-[13px] text-inkMuted">
            Sent a photo
          </span>
          {unreadBadge}
        </div>
      )}

      {mt === "voice" && (
        <div className="mt-1 flex items-center gap-1.5 text-[13px] text-inkMuted">
          <Mic className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={2} />
          <span className="min-w-0 flex-1 truncate">
            Voice message · {t.voiceDuration ?? "0:00"}
          </span>
          {unreadBadge}
        </div>
      )}

      {mt === "reaction" && (
        <p className="mt-1 text-[13px] italic text-gray-500">
          <span className="not-italic">{t.reactionEmoji ?? "❤️"}</span> Reacted to
          your message
        </p>
      )}

      {mt === "text" && (
        <div className="mt-1 flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate text-[13px] text-inkMuted">
            {t.lastMessage}
          </p>
          {unreadBadge}
        </div>
      )}

      {locked && (
        <p className="mt-1 truncate text-[13px] italic text-gray-500">
          🔗 Link to see their message
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
          Link
        </button>
      </div>
    );
  }

  return (
    <Link
      href={`/messages/${t.id}`}
      className="flex min-h-[72px] items-start gap-3 px-4 py-3.5 transition-colors active:bg-black/[0.02]"
    >
      {avatar}
      {mainColumn}
    </Link>
  );
}

export function MessagesView({
  initialThreads,
  onlineRailUsers,
  headerCredits,
}: {
  initialThreads?: MessageThread[];
  onlineRailUsers: OnlineUser[];
  headerCredits: number;
}) {
  const router = useRouter();
  const [revealedLocked, setRevealedLocked] = useState<Set<string>>(() => new Set());

  /** Refetch inbox when opening this tab — avoids stale Router Cache after new chats. */
  useEffect(() => {
    router.refresh();
  }, [router]);

  /** Server is the source of truth; never show legacy mock threads in the inbox. */
  const source = initialThreads ?? [];
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
      byId.set(
        t.id,
        o
          ? mergePreview(
              t,
              o.lastMessage,
              o.timestampLabel,
              o.lastActivityAt,
            )
          : t,
      );
    }

    for (const id of Object.keys(previews.byId)) {
      if (byId.has(id)) continue;
      const o = previews.byId[id];
      if (!o) continue;
      const stub = getThreadMeta(id);
      byId.set(
        id,
        normalizeThread({
          id,
          name: o.name ?? stub.name,
          avatarUrl: o.avatarUrl ?? stub.avatarUrl,
          verified: o.verified ?? stub.verified,
          showOnlineDot: o.showOnlineDot ?? stub.onlineNow,
          lastMessage: o.lastMessage,
          timestampLabel: o.timestampLabel,
          lastActivityAt:
            o.lastActivityAt ?? new Date().toISOString(),
          messageType: "text",
        }),
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
    <div className="bg-[#F5F3EE] pb-6">
      <StatusBarMock />

      <header className="flex items-start justify-between gap-3 px-5 pb-1 pt-2">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">
          Messages
        </h1>
        <MessagesHeaderActions credits={headerCredits} />
      </header>

      <OnlineNowRail compact className="pt-3" users={onlineRailUsers} />

      <PinnedSection threads={pinnedThreads} />

      <section className="pt-2">
        <div className="mb-2 flex items-center justify-between px-5">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Conversations
          </h2>
          <span className="text-[12px] font-semibold text-primary">
            {sorted.length} chats
          </span>
        </div>

        <div className="overflow-hidden border-y border-black/[0.06] bg-white shadow-sm">
          {sorted.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <p className="text-[15px] font-semibold text-ink">
                No conversations yet
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-inkMuted">
                Open someone&apos;s profile from the home grid and send a message
                — your chats will show up here.
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 py-2.5 text-[14px] font-bold text-white shadow-pill transition active:scale-[0.99]"
              >
                Browse profiles
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
