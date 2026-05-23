"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, MoreHorizontal, User } from "lucide-react";
import type { ChatMessage } from "@/data/messages";
import {
  formatConversationShortLabel,
  formatOperatorContextLine,
  formatRecentTranscript,
} from "@/lib/operator/conversation-label";
import { getPersonaAccent } from "@/lib/operator/persona-style";
import {
  isOperatorLivePollActive,
  OPERATOR_INBOX_POLL_MS,
  OPERATOR_THREAD_POLL_MS,
} from "@/lib/operator/live-poll";

type InboxItem = {
  conversationId: string;
  peerId: string;
  peerDisplayName: string;
  ownerDisplayName: string;
  ownerPhotoUrl: string;
  ownerAge: number | null;
  ownerLocation: string;
  userEmail: string | null;
  lastMessagePreview: string | null;
  lastUserMessageAt: string | null;
  unreadForOperator: boolean;
};

type UserThreadItem = {
  conversationId: string;
  peerId: string;
  peerDisplayName: string;
  peerAvatarUrl: string;
  lastMessagePreview: string | null;
  lastActivityAt: string | null;
  needsOperatorReply: boolean;
  operatorStatus: string | null;
};

type ThreadDetail = {
  conversationId: string;
  ownerUserId: string;
  peerId: string;
  peer: { display_name: string; avatar_url: string };
  ownerDisplayName: string;
  ownerPhotoUrl: string;
  ownerAge: number | null;
  ownerLocation: string;
  ownerEmail: string | null;
  ownerCredits: number;
  messages: ChatMessage[];
  memorySummary: string | null;
};

function OperatorUserCreditsBadge({ credits }: { credits: number }) {
  const low = credits < 60;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ${
        low
          ? "bg-red-50 text-red-800 ring-red-200"
          : "bg-amber-50 text-amber-950 ring-amber-200"
      }`}
      title="Credits saldo van deze gebruiker"
    >
      <span aria-hidden className="text-[10px]">
        {low ? "⚠" : "◎"}
      </span>
      {credits} credits
    </span>
  );
}

function formatRel(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PersonaBadge({
  peerId,
  name,
  size = "sm",
}: {
  peerId: string;
  name: string;
  size?: "sm" | "md";
}) {
  const accent = getPersonaAccent(peerId);
  return (
    <span
      className={`inline-flex max-w-full truncate rounded-full font-semibold ${accent.badgeBg} ${accent.badgeText} ${
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[10px]"
      }`}
    >
      {name}
    </span>
  );
}

function Avatar({
  src,
  alt,
  size = "md",
  className = "",
}: {
  src: string | null | undefined;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim =
    size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const px = size === "lg" ? 48 : size === "sm" ? 32 : 40;
  const hasSrc = Boolean(src?.trim());
  if (hasSrc) {
    return (
      <Image
        src={src!}
        alt={alt}
        width={px}
        height={px}
        className={`${dim} shrink-0 rounded-full object-cover ${className}`}
        unoptimized={src!.startsWith("http")}
      />
    );
  }
  return (
    <span
      className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-500 ${className}`}
      aria-hidden
    >
      <User
        className={
          size === "lg" ? "h-6 w-6" : size === "sm" ? "h-4 w-4" : "h-5 w-5"
        }
        strokeWidth={2}
      />
    </span>
  );
}

function isOperatorImageMessage(message: ChatMessage): boolean {
  if (message.kind === "image") return true;
  const url = message.imageUrl?.trim();
  if (!url) return false;
  const body = message.body?.trim().toLowerCase();
  return !body || body === "[afbeelding]" || body === "afbeelding";
}

function imageCaption(message: ChatMessage): string | null {
  const body = message.body?.trim();
  if (!body) return null;
  const lower = body.toLowerCase();
  if (lower === "[afbeelding]" || lower === "afbeelding") return null;
  return body;
}

function OperatorChatImage({
  url,
  caption,
  isPeer,
  peerBubbleClass,
}: {
  url: string;
  caption: string | null;
  isPeer: boolean;
  peerBubbleClass: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="min-w-0 max-w-[min(78%,100%)] shrink overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/[0.06]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="block w-full bg-neutral-100 text-left active:opacity-95"
        aria-expanded={expanded}
        aria-label={
          expanded ? "Afbeelding verkleinen" : "Afbeelding vergroten"
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Verzonden afbeelding"
          loading="lazy"
          decoding="async"
          className={
            expanded
              ? "block h-auto max-h-[min(50vh,320px)] w-full max-w-[min(88vw,300px)] object-contain"
              : "block h-auto max-h-[120px] w-auto max-w-[min(56vw,152px)] cursor-zoom-in object-cover"
          }
        />
      </button>
      {caption ? (
        <p
          className={`px-3.5 py-2 text-[15px] leading-snug ${
            isPeer
              ? `text-white ${peerBubbleClass}`
              : "bg-white text-neutral-900"
          }`}
        >
          {caption}
        </p>
      ) : null}
    </div>
  );
}

function OperatorMessageBubble({
  message,
  isPeer,
  peerBubbleClass,
}: {
  message: ChatMessage;
  isPeer: boolean;
  peerBubbleClass: string;
}) {
  if (isOperatorImageMessage(message)) {
    const url = message.imageUrl?.trim();
    if (!url) {
      return (
        <div
          className={`max-w-[min(78%,100%)] min-w-0 rounded-2xl px-3.5 py-2 text-[15px] italic shadow-sm ${
            isPeer
              ? `rounded-br-md text-white/90 ${peerBubbleClass}`
              : "rounded-bl-md bg-white text-neutral-500"
          }`}
        >
          Afbeelding (niet beschikbaar)
        </div>
      );
    }
    return (
      <OperatorChatImage
        url={url}
        caption={imageCaption(message)}
        isPeer={isPeer}
        peerBubbleClass={peerBubbleClass}
      />
    );
  }

  if (message.kind === "gift") {
    return (
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
          isPeer
            ? `rounded-br-md text-white ${peerBubbleClass}`
            : "rounded-bl-md bg-white text-neutral-900"
        }`}
      >
        🎁 Gift · {message.giftCredits ?? 0} credits
      </div>
    );
  }

  return (
    <div
      className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
        isPeer
          ? `rounded-br-md text-white ${peerBubbleClass}`
          : "rounded-bl-md bg-white text-neutral-900"
      }`}
    >
      <p className="whitespace-pre-wrap break-words">{message.body ?? ""}</p>
    </div>
  );
}

function OperatorSummaryBody({ text }: { text: string }) {
  const blocks = text.split(/(?=^## )/m).filter(Boolean);
  if (blocks.length <= 1 && !text.includes("## ")) {
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
        {text}
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => {
        const lines = block.trim().split("\n");
        const title = lines[0]?.replace(/^##\s*/, "") ?? "";
        const body = lines.slice(1).join("\n").trim();
        return (
          <section key={i}>
            {title && (
              <h4 className="mb-1 text-sm font-semibold text-neutral-900">
                {title}
              </h4>
            )}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
              {body || title}
            </p>
          </section>
        );
      })}
    </div>
  );
}

export function OperatorInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [userChatsOpen, setUserChatsOpen] = useState(false);
  const [userThreads, setUserThreads] = useState<UserThreadItem[]>([]);
  const [userThreadsLoading, setUserThreadsLoading] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryCached, setSummaryCached] = useState(false);
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState<string | null>(
    null,
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  const inThread = Boolean(selectedId && detail);

  const visibleItems = useMemo(() => {
    let list = [...items];
    if (onlyUnread) list = list.filter((i) => i.unreadForOperator);
    list.sort((a, b) => {
      const ta = a.lastUserMessageAt
        ? new Date(a.lastUserMessageAt).getTime()
        : 0;
      const tb = b.lastUserMessageAt
        ? new Date(b.lastUserMessageAt).getTime()
        : 0;
      return tb - ta;
    });
    return list;
  }, [items, onlyUnread]);

  const loadInbox = useCallback(async () => {
    const res = await fetch("/api/operator/conversations", { cache: "no-store" });
    const data = (await res.json()) as {
      ok: boolean;
      conversations?: InboxItem[];
      error?: string;
    };
    if (!data.ok) {
      setError(data.error ?? "Inbox laden mislukt");
      return;
    }
    setItems(data.conversations ?? []);
    if (!selectedId) setError(null);
  }, [selectedId]);

  const loadThread = useCallback(
    async (conversationId: string, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      const res = await fetch(
        `/api/operator/conversations/${conversationId}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as ThreadDetail & {
        ok: boolean;
        error?: string;
      };
      if (!opts?.silent) setLoading(false);
      if (!data.ok) {
        if (!opts?.silent) {
          setError(data.error ?? "Gesprek laden mislukt");
        }
        return;
      }
      setDetail({
        conversationId: data.conversationId,
        ownerUserId: data.ownerUserId,
        peerId: data.peerId,
        peer: data.peer,
        ownerDisplayName: data.ownerDisplayName,
        ownerPhotoUrl: data.ownerPhotoUrl,
        ownerAge: data.ownerAge ?? null,
        ownerLocation: data.ownerLocation ?? "",
        ownerEmail: data.ownerEmail,
        ownerCredits:
          typeof data.ownerCredits === "number" ? data.ownerCredits : 0,
        messages: data.messages,
        memorySummary: data.memorySummary ?? null,
      });
      setItems((prev) =>
        prev.map((i) =>
          i.conversationId === conversationId
            ? { ...i, unreadForOperator: false }
            : i,
        ),
      );
      if (!opts?.silent) setError(null);
    },
    [],
  );

  const loadUserThreads = useCallback(async (ownerUserId: string) => {
    setUserThreadsLoading(true);
    try {
      const res = await fetch(
        `/api/operator/users/${encodeURIComponent(ownerUserId)}/conversations`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        ok: boolean;
        threads?: UserThreadItem[];
        error?: string;
      };
      if (!data.ok) {
        setError(data.error ?? "Chats laden mislukt");
        return;
      }
      setUserThreads(data.threads ?? []);
    } catch {
      setError("Chats laden mislukt");
    } finally {
      setUserThreadsLoading(false);
    }
  }, []);

  const refreshLive = useCallback(() => {
    if (!isOperatorLivePollActive()) return;
    void loadInbox();
    if (selectedId) {
      void loadThread(selectedId, { silent: true });
    }
    if (userChatsOpen && detail?.ownerUserId) {
      void loadUserThreads(detail.ownerUserId);
    }
  }, [
    loadInbox,
    loadThread,
    selectedId,
    userChatsOpen,
    detail?.ownerUserId,
    loadUserThreads,
  ]);

  useEffect(() => {
    void loadInbox();
    const inboxTimer = window.setInterval(() => {
      if (!isOperatorLivePollActive()) return;
      void loadInbox();
    }, OPERATOR_INBOX_POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") refreshLive();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      window.clearInterval(inboxTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [loadInbox, refreshLive]);

  useEffect(() => {
    if (!selectedId) return;
    lastMessageIdRef.current = null;
    void loadThread(selectedId);

    const threadTimer = window.setInterval(() => {
      if (!isOperatorLivePollActive()) return;
      void loadThread(selectedId, { silent: true });
      void loadInbox();
    }, OPERATOR_THREAD_POLL_MS);

    return () => window.clearInterval(threadTimer);
  }, [selectedId, loadThread, loadInbox]);

  useEffect(() => {
    if (!inThread || !detail?.messages.length) return;
    const last = detail.messages[detail.messages.length - 1]?.id ?? null;
    const prev = lastMessageIdRef.current;
    if (last && last !== prev) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    lastMessageIdRef.current = last;
  }, [detail?.messages, inThread]);

  function selectConversation(id: string) {
    setSelectedId(id);
    setMenuOpen(false);
    setError(null);
  }

  function backToList() {
    setSelectedId(null);
    setDetail(null);
    setReplyText("");
    setMenuOpen(false);
    setUserChatsOpen(false);
    setUserThreads([]);
    setError(null);
  }

  function toggleUserChats() {
    if (!detail) return;
    const next = !userChatsOpen;
    setUserChatsOpen(next);
    setMenuOpen(false);
    if (next) {
      void loadUserThreads(detail.ownerUserId);
    }
  }

  function switchToConversation(conversationId: string) {
    if (conversationId === selectedId) {
      setUserChatsOpen(false);
      return;
    }
    setSelectedId(conversationId);
    setReplyText("");
    setUserChatsOpen(false);
    setError(null);
  }

  async function sendReply() {
    if (!selectedId || !replyText.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/operator/conversations/${selectedId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: replyText.trim() }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    setLoading(false);
    if (!data.ok) {
      setError(data.error ?? "Verzenden mislukt");
      return;
    }
    setReplyText("");
    await loadThread(selectedId);
    await loadInbox();
  }

  function applySummaryResponse(data: {
    summary?: string | null;
    cached?: boolean;
    generatedAt?: string;
  }) {
    setSummaryText(data.summary ?? null);
    setSummaryCached(Boolean(data.cached));
    setSummaryGeneratedAt(data.generatedAt ?? null);
  }

  async function openSummary() {
    if (!selectedId) return;
    setMenuOpen(false);
    setSummaryOpen(true);
    setSummaryLoading(true);
    setSummaryText(null);
    setSummaryCached(false);
    setSummaryGeneratedAt(null);
    try {
      const res = await fetch(
        `/api/operator/conversations/${selectedId}/summary`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        ok: boolean;
        summary?: string | null;
        cached?: boolean;
        generatedAt?: string;
        error?: string;
      };
      if (!data.ok) {
        setError(data.error ?? "Samenvatting laden mislukt");
        setSummaryOpen(false);
        return;
      }
      applySummaryResponse(data);
    } catch {
      setError("Samenvatting laden mislukt");
      setSummaryOpen(false);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function regenerateSummary() {
    if (!selectedId) return;
    setSummaryLoading(true);
    try {
      const res = await fetch(
        `/api/operator/conversations/${selectedId}/summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: true }),
          cache: "no-store",
        },
      );
      const data = (await res.json()) as {
        ok: boolean;
        summary?: string;
        cached?: boolean;
        generatedAt?: string;
        error?: string;
      };
      if (!data.ok) {
        setError(data.error ?? "Samenvatting mislukt");
        return;
      }
      applySummaryResponse(data);
    } catch {
      setError("Samenvatting mislukt");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function generateSummaryFirstTime() {
    if (!selectedId) return;
    setSummaryLoading(true);
    try {
      const res = await fetch(
        `/api/operator/conversations/${selectedId}/summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: false }),
          cache: "no-store",
        },
      );
      const data = (await res.json()) as {
        ok: boolean;
        summary?: string;
        generatedAt?: string;
        error?: string;
      };
      if (!data.ok) {
        setError(data.error ?? "Samenvatting mislukt");
        return;
      }
      applySummaryResponse({ ...data, cached: false });
    } catch {
      setError("Samenvatting mislukt");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function fetchSuggestion() {
    if (!selectedId) return;
    setMenuOpen(false);
    setLoading(true);
    const res = await fetch(
      `/api/operator/conversations/${selectedId}/suggest-reply`,
      { method: "POST" },
    );
    const data = (await res.json()) as {
      ok: boolean;
      suggestion?: string;
      error?: string;
    };
    setLoading(false);
    if (!data.ok) {
      setError(data.error ?? "Suggestie mislukt");
      return;
    }
    if (data.suggestion) setReplyText(data.suggestion);
  }

  async function markClosed() {
    if (!selectedId) return;
    setMenuOpen(false);
    await fetch(`/api/operator/conversations/${selectedId}/close`, {
      method: "POST",
    });
    await loadInbox();
    backToList();
  }

  const threadAccent = detail ? getPersonaAccent(detail.peerId) : null;
  const transcript =
    detail &&
    formatRecentTranscript(detail.messages, {
      maxLines: 6,
      peerName: detail.peer.display_name,
    });

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden lg:flex-row">
      <div
        className={`flex h-full min-h-0 flex-col bg-white lg:max-w-sm lg:shrink-0 lg:border-r lg:border-neutral-200 ${
          inThread ? "hidden lg:flex" : "flex"
        }`}
      >
          <div className="shrink-0 border-b border-neutral-200 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-neutral-900">
                Gesprekken
              </h2>
              <Link
                href="/admin"
                className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
              >
                Admin
              </Link>
            </div>
            <p className="text-xs text-neutral-500">
              {visibleItems.length}{" "}
              {visibleItems.length === 1 ? "gesprek" : "gesprekken"}
              {onlyUnread ? " (ongelezen)" : ""}
            </p>
            <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
              <input
                type="checkbox"
                checked={onlyUnread}
                onChange={(e) => setOnlyUnread(e.target.checked)}
                className="rounded border-neutral-300"
              />
              Alleen ongelezen
            </label>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {visibleItems.map((item) => {
              const accent = getPersonaAccent(item.peerId);
              return (
                <li key={item.conversationId}>
                  <button
                    type="button"
                    onClick={() => selectConversation(item.conversationId)}
                    className={`flex w-full gap-3 border-b border-neutral-50 px-4 py-3.5 text-left active:bg-neutral-50 ${
                      selectedId === item.conversationId
                        ? "bg-primary/5 lg:bg-primary/[0.07]"
                        : ""
                    }`}
                  >
                    <div
                      className={`w-1 shrink-0 self-stretch rounded-full ${accent.headerBar}`}
                    />
                    <Avatar
                      src={item.ownerPhotoUrl}
                      alt={item.ownerDisplayName}
                      size="lg"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[15px] font-semibold text-neutral-900">
                          {item.ownerDisplayName}
                        </span>
                        {item.lastUserMessageAt && (
                          <span className="shrink-0 text-[11px] text-neutral-400">
                            {formatRel(item.lastUserMessageAt)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <PersonaBadge
                          peerId={item.peerId}
                          name={item.peerDisplayName}
                        />
                        {item.userEmail && (
                          <span className="truncate text-[10px] text-neutral-400">
                            {item.userEmail}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-neutral-600">
                        {item.lastMessagePreview ?? "—"}
                      </p>
                    </div>
                    {item.unreadForOperator && (
                      <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                </li>
              );
            })}
            {visibleItems.length === 0 && (
              <li className="px-4 py-16 text-center text-sm text-neutral-500">
                Geen gesprekken
              </li>
            )}
          </ul>
      </div>

      {inThread && detail && threadAccent && (
        <div className="fixed inset-0 z-50 flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-[#f0f0f0] lg:static lg:z-auto lg:h-full lg:max-h-full lg:min-h-0 lg:min-w-0 lg:flex-1">
          <header className="shrink-0 bg-white shadow-sm">
            <div
              className={`h-1 ${threadAccent.headerBar}`}
              aria-hidden
            />
            <div className="flex items-center gap-2 px-2 py-2 pt-[max(0.25rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={backToList}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-800 active:bg-neutral-100 lg:hidden"
                aria-label="Terug naar gesprekken"
              >
                <ChevronLeft className="h-6 w-6" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={toggleUserChats}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-xl py-1 text-left active:bg-neutral-100"
                aria-expanded={userChatsOpen}
                aria-label="Alle chats van deze gebruiker"
              >
                <Avatar
                  src={detail.ownerPhotoUrl}
                  alt={detail.ownerDisplayName}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 truncate text-[15px] font-semibold leading-tight text-neutral-900">
                      {detail.ownerDisplayName}
                    </p>
                    <OperatorUserCreditsBadge credits={detail.ownerCredits} />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-neutral-500">
                      Antwoord als
                    </span>
                    <PersonaBadge
                      peerId={detail.peerId}
                      name={detail.peer.display_name}
                      size="md"
                    />
                  </div>
                  <p className="mt-0.5 text-[10px] font-medium text-primary lg:hidden">
                    {userChatsOpen
                      ? "Verberg chats"
                      : "Tik voor alle chats van deze user"}
                  </p>
                  <p className="mt-0.5 hidden text-[10px] font-medium text-primary lg:block">
                    {userChatsOpen ? "Verberg chats" : "Alle chats van user"}
                  </p>
                </div>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-neutral-400 transition-transform ${
                    userChatsOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-600 active:bg-neutral-100"
                  aria-label="Meer opties"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
                {menuOpen && (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-10"
                      aria-label="Menu sluiten"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        disabled={loading || summaryLoading}
                        onClick={() => void openSummary()}
                        className="block w-full px-4 py-2.5 text-left text-sm text-neutral-800 active:bg-neutral-50"
                      >
                        Samenvatting
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void fetchSuggestion()}
                        className="block w-full px-4 py-2.5 text-left text-sm text-neutral-800 active:bg-neutral-50"
                      >
                        AI-suggestie
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => void markClosed()}
                        className="block w-full px-4 py-2.5 text-left text-sm text-neutral-600 active:bg-neutral-50"
                      >
                        Afsluiten
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="hidden items-center justify-end border-t border-neutral-100 bg-neutral-50 px-3 py-1.5 lg:flex">
              <OperatorUserCreditsBadge credits={detail.ownerCredits} />
            </div>
            <div className="border-t border-neutral-100 bg-neutral-50 px-3 py-2 text-[11px] leading-snug text-neutral-600 max-lg:block lg:hidden">
              <p>
                {formatOperatorContextLine({
                  ownerDisplayName: detail.ownerDisplayName,
                  peerDisplayName: detail.peer.display_name,
                  userEmail: detail.ownerEmail,
                  ownerAge: detail.ownerAge,
                  ownerLocation: detail.ownerLocation,
                  ownerCredits: detail.ownerCredits,
                })}
              </p>
              <p className="mt-0.5 font-medium text-neutral-500">
                {formatConversationShortLabel({
                  ownerDisplayName: detail.ownerDisplayName,
                  peerDisplayName: detail.peer.display_name,
                  userEmail: detail.ownerEmail,
                  ownerAge: detail.ownerAge,
                  ownerLocation: detail.ownerLocation,
                })}
              </p>
              {detail.memorySummary && (
                <p className="mt-1 line-clamp-2 text-neutral-500">
                  {detail.memorySummary}
                </p>
              )}
            </div>

            {userChatsOpen && (
              <div className="max-h-[40vh] overflow-y-auto border-t border-neutral-200 bg-white">
                <p className="sticky top-0 z-[1] border-b border-neutral-100 bg-white px-3 py-2 text-xs font-semibold text-neutral-700">
                  Chats van {detail.ownerDisplayName}
                  {userThreads.length > 0
                    ? ` (${userThreads.length})`
                    : ""}
                </p>
                {userThreadsLoading && (
                  <p className="px-3 py-4 text-center text-xs text-neutral-500">
                    Laden…
                  </p>
                )}
                {!userThreadsLoading && userThreads.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-neutral-500">
                    Geen andere chats
                  </p>
                )}
                <ul>
                  {userThreads.map((t) => {
                    const accent = getPersonaAccent(t.peerId);
                    const isActive = t.conversationId === selectedId;
                    return (
                      <li key={t.conversationId}>
                        <button
                          type="button"
                          onClick={() => switchToConversation(t.conversationId)}
                          className={`flex w-full gap-2.5 px-3 py-3 text-left active:bg-neutral-50 ${
                            isActive ? "bg-primary/5" : ""
                          }`}
                        >
                          <div
                            className={`w-1 shrink-0 self-stretch rounded-full ${accent.headerBar}`}
                          />
                          <Avatar
                            src={t.peerAvatarUrl}
                            alt={t.peerDisplayName}
                            size="sm"
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <PersonaBadge
                                peerId={t.peerId}
                                name={t.peerDisplayName}
                                size="md"
                              />
                              {t.lastActivityAt && (
                                <span className="shrink-0 text-[10px] text-neutral-400">
                                  {formatRel(t.lastActivityAt)}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-neutral-600">
                              {t.lastMessagePreview ?? "—"}
                            </p>
                            {t.needsOperatorReply && (
                              <span className="mt-1 inline-block text-[10px] font-medium text-primary">
                                Wacht op antwoord
                              </span>
                            )}
                            {isActive && (
                              <span className="mt-1 inline-block text-[10px] text-neutral-500">
                                Huidige chat
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </header>

          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
            {loading && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#f0f0f0]/60 text-sm text-neutral-600">
                Laden…
              </div>
            )}
            {transcript && detail.messages.length > 8 && (
              <pre className="mb-3 hidden whitespace-pre-wrap rounded-xl border border-neutral-200/80 bg-white/90 p-2.5 text-[10px] leading-relaxed text-neutral-600 sm:block">
                {transcript}
              </pre>
            )}
            <div className="space-y-1">
              {detail.messages.map((m) => {
                const isPeer = m.sender === "peer";
                return (
                  <div
                    key={m.id}
                    className={`flex gap-2 ${isPeer ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {!isPeer ? (
                      <Avatar
                        src={detail.ownerPhotoUrl}
                        alt=""
                        size="sm"
                        className="mt-1"
                      />
                    ) : (
                      <Avatar
                        src={detail.peer.avatar_url}
                        alt=""
                        size="sm"
                        className="mt-1"
                      />
                    )}
                    <OperatorMessageBubble
                      message={m}
                      isPeer={isPeer}
                      peerBubbleClass={threadAccent.bubbleClass}
                    />
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {error && (
            <p className="shrink-0 bg-red-50 px-4 py-2 text-center text-xs text-red-800">
              {error}
            </p>
          )}

          {summaryOpen && (
            <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-3 sm:items-center">
              <button
                type="button"
                className="absolute inset-0"
                aria-label="Sluit samenvatting"
                onClick={() => setSummaryOpen(false)}
              />
              <div className="relative z-[1] flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                  <h3 className="text-base font-semibold text-neutral-900">
                    Gesprekssamenvatting
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSummaryOpen(false)}
                    className="rounded-lg px-2 py-1 text-sm text-neutral-600 active:bg-neutral-100"
                  >
                    Sluiten
                  </button>
                </div>
                <div className="overflow-y-auto px-4 py-4">
                  {summaryLoading && (
                    <p className="text-sm text-neutral-500">
                      {summaryText
                        ? "Bezig…"
                        : "Grok maakt samenvatting… (kan ~10 s duren)"}
                    </p>
                  )}
                  {!summaryLoading && summaryText && (
                    <>
                      {summaryCached && summaryGeneratedAt && (
                        <p className="mb-3 text-[11px] text-neutral-500">
                          Opgeslagen ·{" "}
                          {new Date(summaryGeneratedAt).toLocaleString("nl-NL", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      )}
                      <OperatorSummaryBody text={summaryText} />
                    </>
                  )}
                  {!summaryLoading && !summaryText && (
                    <p className="text-sm text-neutral-600">
                      Nog geen samenvatting voor dit gesprek. Genereer er een
                      met Grok (eenmalig, daarna onthouden).
                    </p>
                  )}
                </div>
                <div className="space-y-2 border-t border-neutral-100 p-3">
                  {!summaryText && (
                    <button
                      type="button"
                      disabled={summaryLoading}
                      onClick={() => void generateSummaryFirstTime()}
                      className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Genereer samenvatting
                    </button>
                  )}
                  {summaryText && (
                    <button
                      type="button"
                      disabled={summaryLoading}
                      onClick={() => void regenerateSummary()}
                      className="w-full rounded-xl border border-neutral-200 py-2.5 text-sm font-medium text-neutral-800 active:bg-neutral-50 disabled:opacity-50"
                    >
                      Opnieuw genereren (Grok)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <footer className="shrink-0 border-t border-neutral-200/80 bg-white p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <div className="mb-1.5 flex flex-wrap items-center justify-center gap-2 px-1">
              <p className="text-center text-[10px] font-medium text-neutral-500">
                Stuur als {detail.peer.display_name}
              </p>
              <OperatorUserCreditsBadge credits={detail.ownerCredits} />
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={1}
                placeholder="Bericht…"
                className="max-h-28 min-h-[44px] flex-1 resize-none rounded-3xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-base leading-snug focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendReply();
                  }
                }}
              />
              <button
                type="button"
                disabled={loading || !replyText.trim()}
                onClick={() => void sendReply()}
                className={`flex h-11 min-w-[4.5rem] shrink-0 items-center justify-center rounded-full px-4 text-sm font-semibold text-white disabled:opacity-40 ${threadAccent.bubbleClass}`}
              >
                Stuur
              </button>
            </div>
          </footer>
        </div>
      )}

      {!inThread && (
        <div className="hidden h-full min-h-0 flex-1 items-center justify-center overflow-hidden bg-neutral-100 text-sm text-neutral-500 lg:flex">
          Kies een gesprek
        </div>
      )}
    </div>
  );
}
