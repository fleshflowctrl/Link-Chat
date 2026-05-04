"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  BadgeCheck,
  Bell,
  Link2,
  Mic,
  Pin,
} from "lucide-react";
import { OnlineNowRail } from "@/components/OnlineNowRail";
import {
  linkedUsers,
  linkedWithYouNewCount,
  messageThreads,
  sortThreadsByRecency,
  type MessageThread,
  type MessagePreviewType,
} from "@/data/messages";
import { homeUnreadNotificationCount, meProfile } from "@/data/me";
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

function mergePreview(t: MessageThread, lastMessage?: string, ts?: string): MessageThread {
  return {
    ...t,
    lastMessage: lastMessage ?? t.lastMessage,
    timestampLabel: ts ?? t.timestampLabel,
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

function MessagesHeaderActions() {
  const credits = meProfile.stats.credits.value;
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

function LinkedWithYouStrip() {
  return (
    <section className="px-5 pb-4 pt-2">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[15px]" aria-hidden>
          🔗
        </span>
        <h2 className="text-[14px] font-bold text-ink">Linked with you</h2>
        {linkedWithYouNewCount > 0 && (
          <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-600">
            {linkedWithYouNewCount} new
          </span>
        )}
      </div>

      <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
        {linkedUsers.map((user) => (
          <div
            key={user.id}
            className="relative w-[110px] shrink-0 overflow-hidden rounded-2xl shadow-sm"
          >
            <div className="relative aspect-[3/4] w-full">
              <Image
                src={user.photo}
                alt=""
                fill
                sizes="110px"
                className="object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
              {user.isNew && (
                <span className="absolute left-2 top-2 z-20 rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-600">
                  NEW
                </span>
              )}
              <Link
                href={`/profile/${user.id}`}
                className="absolute inset-0 bottom-11 z-10"
                aria-label={`View ${user.name}'s profile`}
              />
              <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col gap-1.5 p-2">
                <p className="pointer-events-none text-center text-[12px] font-bold leading-tight text-white drop-shadow-sm">
                  {user.name}, {user.age}
                </p>
                <Link
                  href={`/messages/${user.id}`}
                  className="w-full rounded-full bg-white py-1.5 text-center text-[11px] font-semibold text-gray-900 shadow-sm transition active:scale-[0.98]"
                >
                  Say hi
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PinnedSection({ threads }: { threads: MessageThread[] }) {
  if (threads.length === 0) return null;

  return (
    <section className="px-5 pb-4">
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
}: {
  initialThreads?: MessageThread[];
}) {
  const [revealedLocked, setRevealedLocked] = useState<Set<string>>(() => new Set());

  const source = initialThreads ?? messageThreads;
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
    return normalized.map((t): MessageThread => {
      const o = previews.byId[t.id];
      if (!o) return t;
      return mergePreview(t, o.lastMessage, o.timestampLabel);
    });
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
        <MessagesHeaderActions />
      </header>

      <OnlineNowRail compact className="pt-3" />

      <LinkedWithYouStrip />

      <PinnedSection threads={pinnedThreads} />

      <section className="px-5 pt-2">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Conversations
          </h2>
          <span className="text-[12px] font-semibold text-primary">
            {sorted.length} chats
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
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
        </div>
      </section>
    </div>
  );
}
