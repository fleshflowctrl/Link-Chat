"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Check,
  CheckCheck,
  ChevronLeft,
  Gift,
  MoreHorizontal,
  Plus,
  Send,
  Smile,
} from "lucide-react";
import { WHISPER_USER_KEY } from "@/data/funnel";
import { type ChatMessage } from "@/data/messages";
import type { ThreadMeta } from "@/lib/chat/server-data";
import {
  getThreadPreviewOverride,
  setThreadPreview,
} from "@/lib/thread-preview-store";
import { uploadChatImage } from "@/lib/chat/upload-chat-image";
import { GiftModal } from "@/components/messages/gift-modal";
import { applyOptimisticUnreadDelta } from "@/lib/messages-tab-badge";

const GROUP_GAP_MIN = 5;

function minuteFromClock(m: ChatMessage): number {
  return m.minuteOfDay;
}

type Annotated = ChatMessage & {
  marginTopClass: string;
  showAvatar: boolean;
  showMeta: boolean;
};

function annotateMessages(msgs: ChatMessage[]): Annotated[] {
  return msgs.map((msg, i) => {
    const prev = msgs[i - 1];
    const next = msgs[i + 1];
    const gapPrev = prev ? minuteFromClock(msg) - minuteFromClock(prev) : 99;
    const gapNext = next ? minuteFromClock(next) - minuteFromClock(msg) : 99;
    const sameSenderPrev = Boolean(prev && prev.sender === msg.sender);
    const sameSenderNext = Boolean(next && next.sender === msg.sender);
    const tightPrev = sameSenderPrev && gapPrev <= GROUP_GAP_MIN;
    const tightNext = sameSenderNext && gapNext <= GROUP_GAP_MIN;
    const marginTopClass = i === 0 ? "mt-0" : tightPrev ? "mt-1" : "mt-4";
    const showAvatar =
      msg.sender === "peer" && (!sameSenderNext || !tightNext);
    const showMeta = !sameSenderNext || !tightNext;
    return { ...msg, marginTopClass, showAvatar, showMeta };
  });
}

function nowClock(): { timeLabel: string; minuteOfDay: number } {
  const d = new Date();
  const timeLabel = d.toLocaleTimeString("nl-NL", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
  return { timeLabel, minuteOfDay: d.getHours() * 60 + d.getMinutes() };
}

function gid() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const REACTION_PICK = ["❤️", "😂", "🔥", "😮"] as const;

function GiftBubble({
  credits,
  mine,
}: {
  credits: number;
  mine: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[15px] font-bold shadow-md ring-1 ${
        mine
          ? "rounded-br-md bg-gradient-to-br from-amber-400 to-pink-500 text-white ring-white/30"
          : "rounded-bl-md bg-gradient-to-br from-amber-50 to-pink-50 text-amber-800 ring-amber-200"
      }`}
    >
      <Gift className="h-5 w-5 shrink-0" strokeWidth={2.25} />
      <span className="flex flex-col leading-tight">
        <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
          {mine ? "Cadeau verstuurd" : "Cadeau ontvangen"}
        </span>
        <span className="text-[16px] tabular-nums">{credits} credits</span>
      </span>
    </span>
  );
}

function ReadReceipt({ phase }: { phase: "single" | "double" }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-primary">
      {phase === "single" ? (
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      ) : (
        <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
      )}
    </span>
  );
}

export function ChatConversationView({
  chatId,
  initialMessages,
  threadMeta,
  useSupabase,
}: {
  chatId: string;
  initialMessages: ChatMessage[];
  threadMeta: ThreadMeta;
  useSupabase: boolean;
}) {
  const router = useRouter();
  const meta = threadMeta;
  /** Ids that skip entry animation — SSR baseline, then full list after API sync. */
  const [skipEntryAnimateIds, setSkipEntryAnimateIds] = useState(
    () => new Set(initialMessages.map((m) => m.id)),
  );
  const [messages, setMessages] =
    useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [readPhase, setReadPhase] = useState<Record<string, "single" | "double">>(
    {},
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);
  const [bubbleMenu, setBubbleMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  /** Shown when the AI reply failed (e.g. xAI error); user message is still saved. */
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [composerLift, setComposerLift] = useState(0);
  const longPressRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);

  const annotated = useMemo(() => annotateMessages(messages), [messages]);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const markReadOnServer = useCallback(() => {
    void fetch(`/api/me/threads/${encodeURIComponent(chatId)}/read`, {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    }).catch(() => {});
  }, [chatId]);

  /** Clear unread badge as soon as this conversation is opened. */
  useEffect(() => {
    const o = getThreadPreviewOverride(chatId);
    const wasUnread = (o?.unreadCount ?? 0) > 0;
    setThreadPreview(chatId, {
      lastMessage: o?.lastMessage ?? "",
      timestampLabel: o?.timestampLabel ?? "",
      lastActivityAt: o?.lastActivityAt,
      name: o?.name ?? meta.name,
      avatarUrl: o?.avatarUrl ?? meta.avatarUrl,
      verified: o?.verified ?? meta.verified,
      showOnlineDot: o?.showOnlineDot ?? meta.onlineNow,
      unreadCount: 0,
    });
    if (wasUnread) applyOptimisticUnreadDelta(-1);
    markReadOnServer();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  /** Clear funnel “unread” bump once the thread is opened. */
  useEffect(() => {
    try {
      const raw =
        typeof window !== "undefined"
          ? localStorage.getItem(WHISPER_USER_KEY)
          : null;
      if (!raw) return;
      const u = JSON.parse(raw) as {
        pickedMatchId?: string;
        firstMessage?: string;
      };
      if (u.pickedMatchId !== chatId || !u.firstMessage?.trim()) return;
      const o = getThreadPreviewOverride(chatId);
      setThreadPreview(chatId, {
        lastMessage: o?.lastMessage ?? u.firstMessage.trim(),
        timestampLabel: o?.timestampLabel ?? "now",
        lastActivityAt: o?.lastActivityAt ?? new Date().toISOString(),
        name: meta.name,
        avatarUrl: meta.avatarUrl,
        verified: meta.verified,
        showOnlineDot: meta.onlineNow,
        unreadCount: 0,
      });
    } catch {
      /* ignore */
    }
  }, [chatId, meta.avatarUrl, meta.name, meta.onlineNow, meta.verified]);

  /** If mock transcript missed SSR, merge saved first outbound from onboarding. */
  useEffect(() => {
    if (useSupabase) return;
    try {
      const raw = localStorage.getItem(WHISPER_USER_KEY);
      if (!raw) return;
      const u = JSON.parse(raw) as {
        pickedMatchId?: string;
        firstMessage?: string;
      };
      if (u.pickedMatchId !== chatId || !u.firstMessage?.trim()) return;
      setMessages((prev) => {
        const body = u.firstMessage!.trim();
        if (prev.some((m) => m.sender === "me" && m.body === body)) return prev;
        const { timeLabel, minuteOfDay } = nowClock();
        return [
          ...prev,
          {
            id: `onboard-${Date.now()}`,
            sender: "me" as const,
            kind: "text" as const,
            body,
            timeLabel,
            minuteOfDay,
          },
        ];
      });
    } catch {
      /* ignore */
    }
  }, [chatId, useSupabase]);

  /** Load persisted thread from API — RSC payload can be stale/empty after navigation. */
  useEffect(() => {
    if (!useSupabase) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/conversations/${encodeURIComponent(chatId)}/messages`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as {
          ok?: boolean;
          messages?: ChatMessage[];
        };
        if (cancelled || !res.ok || !data.ok || !Array.isArray(data.messages)) {
          return;
        }
        setMessages(data.messages);
        setSkipEntryAnimateIds(new Set(data.messages.map((m) => m.id)));
      } catch {
        /* keep SSR / local state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, useSupabase]);

  useLayoutEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      const hidden = window.innerHeight - vv.height;
      setComposerLift(hidden > 80 ? hidden : 0);
    };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", onResize);
    };
  }, []);

  const sendText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (!useSupabase) {
        const { timeLabel, minuteOfDay } = nowClock();
        const id = gid();
        setMessages((prev) => [
          ...prev,
          {
            id,
            sender: "me",
            kind: "text",
            body: trimmed,
            timeLabel,
            minuteOfDay,
          },
        ]);
        setInput("");
        setReadPhase((p) => ({ ...p, [id]: "single" }));
        window.setTimeout(() => {
          setReadPhase((p) => ({ ...p, [id]: "double" }));
        }, 520);
        const sentAt = new Date().toISOString();
        setThreadPreview(chatId, {
          lastMessage: trimmed,
          timestampLabel: timeLabel,
          lastActivityAt: sentAt,
          name: meta.name,
          avatarUrl: meta.avatarUrl,
          verified: meta.verified,
          showOnlineDot: meta.onlineNow,
          unreadCount: 0,
        });
        return;
      }

      const { timeLabel, minuteOfDay } = nowClock();
      const tempId = `tmp-${gid()}`;
      const optimisticUserMessage: ChatMessage = {
        id: tempId,
        sender: "me",
        kind: "text",
        body: trimmed,
        timeLabel,
        minuteOfDay,
      };

      setAssistantError(null);
      setInput("");
      setMessages((prev) => [...prev, optimisticUserMessage]);
      setReadPhase((p) => ({ ...p, [tempId]: "single" }));
      const sentAt = new Date().toISOString();
      setThreadPreview(chatId, {
        lastMessage: trimmed,
        timestampLabel: timeLabel,
        lastActivityAt: sentAt,
        name: meta.name,
        avatarUrl: meta.avatarUrl,
        verified: meta.verified,
        showOnlineDot: meta.onlineNow,
        unreadCount: 0,
      });

      try {
        const res = await fetch(
          `/api/conversations/${encodeURIComponent(chatId)}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: trimmed }),
          },
        );
        const data = (await res.json()) as {
          ok?: boolean;
          userMessage?: ChatMessage;
          peerMessage?: ChatMessage | null;
          warning?: string;
          error?: string;
        };

        if (!res.ok || !data.userMessage) {
          console.error("[chat]", data.error ?? res.status);
          setAssistantError(
            typeof data.error === "string"
              ? data.error
              : `Versturen mislukt (${res.status})`,
          );
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          setReadPhase((p) => {
            if (!(tempId in p)) return p;
            const { [tempId]: _, ...rest } = p;
            return rest;
          });
          setInput(trimmed);
          return;
        }

        if (data.warning) {
          console.warn("[chat]", data.warning);
          const short =
            data.warning.length > 220
              ? `${data.warning.slice(0, 220)}…`
              : data.warning;
          setAssistantError(
            data.peerMessage == null
              ? `Antwoord laadt niet: ${short}`
              : short,
          );
        } else {
          setAssistantError(null);
        }

        setMessages((prev) => {
          const replaced = prev.map((m) =>
            m.id === tempId ? data.userMessage! : m,
          );
          return data.peerMessage ? [...replaced, data.peerMessage] : replaced;
        });

        const uid = data.userMessage.id;
        setReadPhase((p) => {
          const { [tempId]: prevPhase, ...rest } = p;
          return { ...rest, [uid]: prevPhase ?? "single" };
        });
        window.setTimeout(() => {
          setReadPhase((p) => ({ ...p, [uid]: "double" }));
        }, 520);

        const preview =
          data.peerMessage?.body ?? data.userMessage.body ?? trimmed;
        setThreadPreview(chatId, {
          lastMessage: preview,
          timestampLabel: nowClock().timeLabel,
          lastActivityAt: new Date().toISOString(),
          name: meta.name,
          avatarUrl: meta.avatarUrl,
          verified: meta.verified,
          showOnlineDot: meta.onlineNow,
        });
        // Persist that we've already seen the AI's reply.
        if (data.peerMessage) markReadOnServer();
      } catch (e) {
        console.error("[chat] send failed", e);
        setAssistantError(
          e instanceof Error
            ? e.message
            : "Netwerkfout — bericht niet verstuurd",
        );
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setReadPhase((p) => {
          if (!(tempId in p)) return p;
          const { [tempId]: _, ...rest } = p;
          return rest;
        });
        setInput(trimmed);
      }
    },
    [chatId, useSupabase, meta],
  );

  const sendImage = useCallback(
    async (publicUrl: string) => {
      if (!publicUrl) return;
      if (!useSupabase) {
        const { timeLabel, minuteOfDay } = nowClock();
        setMessages((prev) => [
          ...prev,
          {
            id: gid(),
            sender: "me",
            kind: "image",
            imageUrl: publicUrl,
            timeLabel,
            minuteOfDay,
          },
        ]);
        return;
      }

      const { timeLabel, minuteOfDay } = nowClock();
      const tempId = `tmp-${gid()}`;
      const optimistic: ChatMessage = {
        id: tempId,
        sender: "me",
        kind: "image",
        imageUrl: publicUrl,
        timeLabel,
        minuteOfDay,
      };

      setAssistantError(null);
      setMessages((prev) => [...prev, optimistic]);
      setThreadPreview(chatId, {
        lastMessage: "Foto",
        timestampLabel: timeLabel,
        lastActivityAt: new Date().toISOString(),
        name: meta.name,
        avatarUrl: meta.avatarUrl,
        verified: meta.verified,
        showOnlineDot: meta.onlineNow,
        unreadCount: 0,
      });

      try {
        const res = await fetch(
          `/api/conversations/${encodeURIComponent(chatId)}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ imageUrl: publicUrl }),
          },
        );
        const data = (await res.json()) as {
          ok?: boolean;
          userMessage?: ChatMessage;
          peerMessage?: ChatMessage | null;
          warning?: string;
          error?: string;
        };
        if (!res.ok || !data.userMessage) {
          setAssistantError(data.error ?? `Foto versturen mislukt (${res.status})`);
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          return;
        }
        setMessages((prev) => {
          const replaced = prev.map((m) =>
            m.id === tempId ? data.userMessage! : m,
          );
          return data.peerMessage ? [...replaced, data.peerMessage] : replaced;
        });
      } catch (e) {
        console.error("[chat] send image failed", e);
        setAssistantError(
          e instanceof Error ? e.message : "Foto versturen mislukt",
        );
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    },
    [chatId, useSupabase, meta],
  );

  const sendGift = useCallback(
    async (amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false as const, error: "Ongeldig bedrag" };

      const { timeLabel, minuteOfDay } = nowClock();
      const tempId = `tmp-${gid()}`;
      const optimistic: ChatMessage = {
        id: tempId,
        sender: "me",
        kind: "text",
        body: `🎁 Cadeau verstuurd: ${amount} credits`,
        timeLabel,
        minuteOfDay,
      };

      setAssistantError(null);
      setMessages((prev) => [...prev, optimistic]);
      setThreadPreview(chatId, {
        lastMessage: `🎁 ${amount} credits`,
        timestampLabel: timeLabel,
        lastActivityAt: new Date().toISOString(),
        name: meta.name,
        avatarUrl: meta.avatarUrl,
        verified: meta.verified,
        showOnlineDot: meta.onlineNow,
        unreadCount: 0,
      });

      try {
        const res = await fetch(
          `/api/conversations/${encodeURIComponent(chatId)}/gifts`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount }),
          },
        );
        const data = (await res.json()) as {
          ok?: boolean;
          userMessage?: ChatMessage;
          peerMessage?: ChatMessage | null;
          newBalance?: number;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.userMessage) {
          setAssistantError(data.error ?? `Cadeau versturen mislukt (${res.status})`);
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          return { ok: false as const, error: data.error ?? "Versturen mislukt" };
        }
        setMessages((prev) => {
          const replaced = prev.map((m) =>
            m.id === tempId ? data.userMessage! : m,
          );
          return data.peerMessage ? [...replaced, data.peerMessage] : replaced;
        });
        return { ok: true as const, newBalance: data.newBalance };
      } catch (e) {
        console.error("[chat] send gift failed", e);
        setAssistantError(
          e instanceof Error ? e.message : "Cadeau versturen mislukt",
        );
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return { ok: false as const, error: "Netwerkfout" };
      }
    },
    [chatId, meta],
  );

  function attachReactionTo(messageId: string, emoji: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, reactionBadge: emoji } : m,
      ),
    );
    setReactionTargetId(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <header className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-black/[0.06] bg-canvas/95 px-3 py-2.5 pt-3 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/90">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/80 text-white shadow-md transition active:scale-95"
          aria-label="Terug"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
        </button>
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-lavender ring-1 ring-black/[0.06]">
          <Image
            src={meta.avatarUrl}
            alt=""
            width={96}
            height={96}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-[16px] font-bold text-ink">
              {meta.name}
            </span>
            {meta.verified && (
              <BadgeCheck
                className="h-[18px] w-[18px] shrink-0 text-primary"
                strokeWidth={2}
                aria-label="Geverifieerd"
              />
            )}
          </div>
          {meta.onlineNow ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-inkMuted">
              <span className="h-2 w-2 shrink-0 rounded-full bg-accentGreen shadow-[0_0_0_2px_rgba(124,92,255,0.12)]" />
              <span className="font-medium text-primary">Nu online</span>
            </p>
          ) : (
            <p className="mt-0.5 text-[12px] text-inkMuted">Offline</p>
          )}
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setHeaderMenuOpen((o) => !o)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-card ring-1 ring-black/[0.06] transition active:scale-95"
            aria-label="Chatopties"
            aria-expanded={headerMenuOpen}
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
          </button>
          <AnimatePresence>
            {headerMenuOpen && (
              <>
                <button
                  type="button"
                  aria-label="Menu sluiten"
                  className="fixed inset-0 z-[60]"
                  onClick={() => setHeaderMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-12 z-[70] min-w-[180px] overflow-hidden rounded-2xl bg-white py-1.5 shadow-xl ring-1 ring-black/[0.08]"
                >
                  <Link
                    href={`/profile/${chatId}`}
                    className="block px-4 py-3 text-[14px] font-semibold text-ink transition hover:bg-black/[0.04]"
                    onClick={() => setHeaderMenuOpen(false)}
                  >
                    Profiel bekijken
                  </Link>
                  <button
                    type="button"
                    className="block w-full px-4 py-3 text-left text-[14px] font-semibold text-ink transition hover:bg-black/[0.04]"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      console.log("[chat] Mute placeholder");
                    }}
                  >
                    Dempen
                  </button>
                  <button
                    type="button"
                    className="block w-full px-4 py-3 text-left text-[14px] font-semibold text-ink transition hover:bg-black/[0.04]"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      console.log("[chat] Block placeholder");
                    }}
                  >
                    Blokkeren
                  </button>
                  <button
                    type="button"
                    className="block w-full px-4 py-3 text-left text-[14px] font-semibold text-red-600 transition hover:bg-red-50"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      console.log("[chat] Report placeholder");
                    }}
                  >
                    Rapporteren
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {assistantError ? (
        <div
          className="shrink-0 border-b border-amber-200/90 bg-amber-50 px-4 py-2.5"
          role="status"
        >
          <p className="text-[12px] font-medium leading-snug text-amber-950">
            {assistantError}
          </p>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-3"
      >
        <p className="py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-inkMuted">
          Vandaag
        </p>

        <div className="space-y-0 pb-4">
          {annotated.map((msg) => (
            <motion.div
              key={msg.id}
              initial={
                skipEntryAnimateIds.has(msg.id)
                  ? false
                  : { scale: 0.94, opacity: 0 }
              }
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
              className={msg.marginTopClass}
            >
              {msg.sender === "peer" ? (
                <div className="flex items-end gap-2">
                  <div className="w-8 shrink-0">
                    {msg.showAvatar ? (
                      <div className="relative h-8 w-8 overflow-hidden rounded-full bg-lavender ring-1 ring-black/[0.06]">
                        <Image
                          src={meta.avatarUrl}
                          alt=""
                          width={64}
                          height={64}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-8 w-8" aria-hidden />
                    )}
                  </div>
                  <div className="max-w-[75%]">
                    <button
                      type="button"
                      className="block w-full text-left"
                      onClick={() => setReactionTargetId(msg.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setBubbleMenu({
                          id: msg.id,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      onPointerDown={(e) => {
                        longPressRef.current = window.setTimeout(() => {
                          setBubbleMenu({
                            id: msg.id,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }, 550);
                      }}
                      onPointerUp={() => {
                        if (longPressRef.current) {
                          window.clearTimeout(longPressRef.current);
                          longPressRef.current = null;
                        }
                      }}
                      onPointerLeave={() => {
                        if (longPressRef.current) {
                          window.clearTimeout(longPressRef.current);
                          longPressRef.current = null;
                        }
                      }}
                    >
                      <span className="relative inline-block max-w-full">
                        {msg.kind === "gift" ? (
                          <GiftBubble
                            credits={msg.giftCredits ?? 0}
                            mine={false}
                          />
                        ) : msg.kind === "text" ? (
                          <span className="inline-block rounded-2xl rounded-bl-md bg-gray-100 px-4 py-2.5 text-[15px] leading-snug text-ink shadow-sm ring-1 ring-black/[0.04]">
                            {msg.body}
                          </span>
                        ) : (
                          <span className="relative block w-[70%] min-w-[200px] max-w-[280px] overflow-hidden rounded-2xl rounded-bl-md bg-gray-100 shadow-sm ring-1 ring-black/[0.06] sm:max-w-[300px]">
                            {msg.imageUrl && (
                              <Image
                                src={msg.imageUrl}
                                alt=""
                                width={600}
                                height={400}
                                className="h-auto w-full object-cover"
                              />
                            )}
                          </span>
                        )}
                        {msg.reactionBadge && (
                          <span className="pointer-events-none absolute -bottom-1.5 left-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[14px] shadow-md ring-1 ring-black/[0.08]">
                            {msg.reactionBadge}
                          </span>
                        )}
                      </span>
                    </button>
                    {msg.showMeta && (
                      <p className="mt-1 pl-0.5 text-[10px] font-medium text-inkMuted">
                        {msg.timeLabel}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <div className="max-w-[75%] text-right">
                    <button
                      type="button"
                      className="inline-block text-left"
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setBubbleMenu({
                          id: msg.id,
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      onPointerDown={(e) => {
                        longPressRef.current = window.setTimeout(() => {
                          setBubbleMenu({
                            id: msg.id,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }, 550);
                      }}
                      onPointerUp={() => {
                        if (longPressRef.current) {
                          window.clearTimeout(longPressRef.current);
                          longPressRef.current = null;
                        }
                      }}
                      onPointerLeave={() => {
                        if (longPressRef.current) {
                          window.clearTimeout(longPressRef.current);
                          longPressRef.current = null;
                        }
                      }}
                    >
                      <span className="relative inline-block max-w-full">
                        {msg.kind === "gift" ? (
                          <GiftBubble
                            credits={msg.giftCredits ?? 0}
                            mine={true}
                          />
                        ) : msg.kind === "text" ? (
                          <span className="inline-block rounded-2xl rounded-br-md bg-gradient-to-br from-primary to-primarySoft px-4 py-2.5 text-left text-[15px] leading-snug text-white shadow-sm">
                            {msg.body}
                          </span>
                        ) : (
                          <span className="relative block w-[70%] min-w-[200px] max-w-[280px] overflow-hidden rounded-2xl rounded-br-md shadow-md ring-1 ring-white/20 sm:max-w-[300px]">
                            {msg.imageUrl && (
                              <Image
                                src={msg.imageUrl}
                                alt=""
                                width={600}
                                height={400}
                                className="h-auto w-full object-cover"
                              />
                            )}
                          </span>
                        )}
                        {msg.reactionBadge && (
                          <span className="pointer-events-none absolute -bottom-1.5 left-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[14px] shadow-md ring-1 ring-black/[0.08]">
                            {msg.reactionBadge}
                          </span>
                        )}
                      </span>
                    </button>
                    {msg.showMeta && (
                      <p className="mt-1 flex items-center justify-end gap-1 pr-0.5 text-[10px] font-medium text-inkMuted">
                        <span>{msg.timeLabel}</span>
                        <ReadReceipt
                          phase={readPhase[msg.id] ?? "double"}
                        />
                      </p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
        <div ref={endRef} className="h-1 shrink-0" aria-hidden />
      </div>

      <AnimatePresence>
        {reactionTargetId && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-black/25"
              aria-label="Reacties sluiten"
              onClick={() => setReactionTargetId(null)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="fixed bottom-28 left-1/2 z-[90] flex -translate-x-1/2 gap-2 rounded-2xl bg-white px-4 py-3 shadow-xl ring-1 ring-black/[0.08]"
            >
              {REACTION_PICK.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/[0.06] text-xl transition active:scale-90"
                  onClick={() =>
                    reactionTargetId &&
                    attachReactionTo(reactionTargetId, emoji)
                  }
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {bubbleMenu && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[100]"
            aria-label="Sluiten"
            onClick={() => setBubbleMenu(null)}
          />
          <div
            className="fixed z-[110] min-w-[160px] overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-black/[0.1]"
            style={{
              left: Math.min(bubbleMenu.x, typeof window !== "undefined" ? window.innerWidth - 180 : 0),
              top: Math.min(bubbleMenu.y, typeof window !== "undefined" ? window.innerHeight - 200 : 0),
            }}
          >
            {(
              [
                { key: "reply", label: "Antwoorden" },
                { key: "copy", label: "Kopiëren" },
                { key: "react", label: "Reageren" },
                { key: "delete", label: "Verwijderen" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className="block w-full px-4 py-2.5 text-left text-[14px] font-semibold text-ink transition hover:bg-black/[0.04]"
                onClick={() => {
                  console.log(`[chat] ${key} on`, bubbleMenu.id);
                  setBubbleMenu(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      <div
        className="shrink-0 border-t border-black/[0.06] bg-canvas/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-md transition-transform supports-[backdrop-filter]:bg-canvas/90"
        style={{
          transform:
            composerLift > 0 ? `translateY(-${composerLift}px)` : undefined,
        }}
      >
        <div className="mx-auto flex max-w-[430px] items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-hidden
            onChange={async (e) => {
              const f = e.currentTarget.files?.[0];
              if (e.currentTarget) e.currentTarget.value = "";
              if (!f || imageBusy) return;
              setImageBusy(true);
              try {
                const r = await uploadChatImage(f);
                if (!r.ok) {
                  setAssistantError(r.error);
                  return;
                }
                await sendImage(r.publicUrl);
              } finally {
                setImageBusy(false);
              }
            }}
          />
          <button
            type="button"
            disabled={imageBusy}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-white shadow-md transition active:scale-95 disabled:opacity-60"
            aria-label="Foto sturen"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendText(input);
                }
              }}
              placeholder="Typ een bericht…"
              className="h-12 w-full rounded-full border-0 bg-white pl-4 pr-12 text-[15px] text-ink shadow-card ring-1 ring-black/[0.06] outline-none transition placeholder:text-inkMuted focus:ring-2 focus:ring-primary/35"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink/40 transition hover:bg-black/[0.05] hover:text-ink/70"
              aria-label="Emoji"
              onClick={() => console.log("[chat] Emoji placeholder")}
            >
              <Smile className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
          {input.trim() ? (
            <motion.button
              type="button"
              key="send"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-white shadow-md transition active:scale-95"
              aria-label="Versturen"
              onClick={() => void sendText(input)}
            >
              <Send className="h-5 w-5" strokeWidth={2.25} />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              key="gift"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-white shadow-md transition active:scale-95"
              aria-label="Cadeau geven"
              onClick={() => setGiftOpen(true)}
            >
              <Gift className="h-5 w-5" strokeWidth={2.25} />
            </motion.button>
          )}
        </div>
      </div>

      <GiftModal
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        peerName={meta.name}
        peerAvatarUrl={meta.avatarUrl}
        onSend={sendGift}
      />
    </div>
  );
}
