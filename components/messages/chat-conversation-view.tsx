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
  Coins,
  Gift,
  MoreHorizontal,
  Plus,
  Send,
} from "lucide-react";
import { type ChatMessage } from "@/data/messages";
import type { ThreadMeta } from "@/lib/chat/server-data";
import {
  requestThreadsRefetch,
  WHISPER_THREADS_REFETCH,
} from "@/lib/session-sync";
import {
  getThreadPreviewOverride,
  setThreadPreview,
} from "@/lib/thread-preview-store";
import { uploadChatImage } from "@/lib/chat/upload-chat-image";
import { GiftModal } from "@/components/messages/gift-modal";
import {
  applyOptimisticUnreadDelta,
  setServerUnreadBaseline,
} from "@/lib/messages-tab-badge";
import { getChatHeaderPresence } from "@/lib/chat/online-status";
import { CHAT_MESSAGE_COST_CREDITS } from "@/lib/credits/pricing";
import { useAppVariant } from "@/components/app-variant-provider";
import { appVariantFetchHeaders, withVariantPath } from "@/lib/app-variant";
import {
  applyServerCreditsUpdate,
  getCreditsSnapshot,
  refreshCreditsFromServer,
} from "@/lib/credits-store";
import {
  formatReadTimeAmsterdam,
  nowAmsterdamClock,
  withAmsterdamMessageTimes,
} from "@/lib/datetime/amsterdam";

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

function gid() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function messageSortKey(m: ChatMessage): number {
  if (m.createdAt) {
    const t = new Date(m.createdAt).getTime();
    if (Number.isFinite(t)) return t;
  }
  return m.minuteOfDay * 60_000;
}

function isOptimisticTempId(id: string): boolean {
  return id.startsWith("tmp-");
}

function optimisticMatchesServerRow(
  opt: ChatMessage,
  serverRow: ChatMessage,
): boolean {
  if (opt.sender !== "me" || serverRow.sender !== "me") return false;
  if (opt.kind !== serverRow.kind) return false;
  if (opt.kind === "text") {
    return (opt.body ?? "").trim() === (serverRow.body ?? "").trim();
  }
  if (opt.kind === "image") {
    return !!opt.imageUrl && opt.imageUrl === serverRow.imageUrl;
  }
  if (opt.kind === "gift") {
    return opt.giftCredits === serverRow.giftCredits;
  }
  return false;
}

function dedupeChatMessagesById(messages: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  const out: ChatMessage[] = [];
  for (const m of messages) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

function finalizeMessagesAfterSend(
  prev: ChatMessage[],
  tempId: string,
  userMessage: ChatMessage,
  extra?: {
    newPeerMessages?: ChatMessage[];
    peerMessage?: ChatMessage | null;
  },
): ChatMessage[] {
  const user = withAmsterdamMessageTimes(userMessage);
  const replaced = prev.map((m) => (m.id === tempId ? user : m));
  const seen = new Set(replaced.map((m) => m.id));
  const additions: ChatMessage[] = [];
  for (const m of extra?.newPeerMessages ?? []) {
    if (!seen.has(m.id)) {
      additions.push(withAmsterdamMessageTimes(m));
      seen.add(m.id);
    }
  }
  if (extra?.peerMessage && !seen.has(extra.peerMessage.id)) {
    additions.push(withAmsterdamMessageTimes(extra.peerMessage));
  }
  return dedupeChatMessagesById(
    additions.length === 0 ? replaced : [...replaced, ...additions],
  );
}

/** Merge server transcript with optimistic rows; never drop in-flight temps. */
function mergeChatMessages(
  prev: ChatMessage[],
  server: ChatMessage[],
): ChatMessage[] {
  const serverIds = new Set(server.map((m) => m.id));
  const serverMe = server.filter((m) => m.sender === "me");
  const optimistic = prev.filter((m) => {
    if (serverIds.has(m.id)) return false;
    // Sync can return the persisted row before we swap tmp-* → real id.
    if (
      isOptimisticTempId(m.id) &&
      serverMe.some((s) => optimisticMatchesServerRow(m, s))
    ) {
      return false;
    }
    return true;
  });
  return dedupeChatMessagesById(
    [...server, ...optimistic].sort(
      (a, b) => messageSortKey(a) - messageSortKey(b),
    ),
  );
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

/**
 * Peer typing indicator shown at the bottom of the message list while we
 * wait for the AI's reply (POST in flight). Uses the same dot animation as
 * the inbox row but inside a peer-bubble shape so it visually integrates
 * with the conversation.
 */
function PeerTypingBubble({ avatarUrl }: { avatarUrl: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="mt-4"
      aria-live="polite"
      aria-label="Aan het typen"
    >
      <div className="flex items-end gap-2">
        <div className="w-8 shrink-0">
          <div className="relative h-8 w-8 overflow-hidden rounded-full bg-lavender ring-1 ring-black/[0.06]">
            <Image
              src={avatarUrl}
              alt=""
              width={64}
              height={64}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm ring-1 ring-black/[0.04]">
          {[0, 140, 280].map((delay) => (
            <span
              key={delay}
              className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-primary/70"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
      </div>
    </motion.div>
  );
}

function ReadReceipt({
  phase,
  read,
}: {
  phase: "single" | "double";
  /** When true, the peer has actually read this message — show a saturated
   * primary-coloured double tick (real-WhatsApp blue). When false, message
   * is delivered but unread → muted grey ticks. */
  read?: boolean;
}) {
  const colour = read ? "text-primary" : "text-inkMuted/70";
  return (
    <span className={`inline-flex items-center gap-0.5 ${colour}`}>
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
  const { variant } = useAppVariant();
  const meta = threadMeta;
  /** Re-render so "Nu online" drops off ~90s after her last bubble. */
  const [onlineTick, setOnlineTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setOnlineTick((n) => (n + 1) & 0x7fffffff), 15_000);
    return () => clearInterval(id);
  }, []);
  /** Ids that skip entry animation — SSR baseline, then full list after API sync. */
  const [skipEntryAnimateIds, setSkipEntryAnimateIds] = useState(
    () => new Set(initialMessages.map((m) => m.id)),
  );
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialMessages.map(withAmsterdamMessageTimes),
  );
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
  /** True only while she's actively delivering a reply (send in-flight or
   * due async delivery) — not during idle waits for a future scheduled_at. */
  const [peerTyping, setPeerTyping] = useState(false);
  /** ISO timestamp when the next async-scheduled AI reply should land, or null
   * if nothing is queued. Set by POST /messages (when a long pause was
   * scheduled), GET /messages (catch-up), and POST /poll-pending. The timer
   * effect below fires `pollPending()` at this moment. */
  const [nextPendingAt, setNextPendingAt] = useState<string | null>(null);
  /** Guard against overlapping pollPending invocations. */
  const pollingRef = useRef(false);
  const sendTextInFlightRef = useRef(false);
  /** Bumps when an early poll returned empty — forces the delivery timer to re-arm. */
  const [pendingScheduleKey, setPendingScheduleKey] = useState(0);

  const stopPeerTyping = useCallback(() => {
    setPeerTyping(false);
  }, []);
  const [composerLift, setComposerLift] = useState(0);
  const longPressRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);

  /** Per-message blur unlock state for this chat session. */
  const [unlockedBlurred, setUnlockedBlurred] = useState<Record<string, boolean>>({});
  const [unlockBusy, setUnlockBusy] = useState<Record<string, boolean>>({});

  const [creditsGateOpen, setCreditsGateOpen] = useState(false);

  const openCreditsGate = useCallback(() => {
    void refreshCreditsFromServer();
    setCreditsGateOpen(true);
  }, []);

  const annotated = useMemo(() => annotateMessages(messages), [messages]);

  /** The id of the LAST user-side message that the persona has read.
   * "Gelezen 14:32" appears only beneath this one; older read messages
   * just get the saturated double-tick without a timestamp. */
  const lastReadUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.sender === "me" && m.peerReadAt) return m.id;
    }
    return null;
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Keep the typing-bubble in view too — when peerTyping toggles on we want
  // the user to *see* it without manually scrolling, otherwise the wait feels
  // like a hung send.
  useEffect(() => {
    if (peerTyping) scrollToBottom();
  }, [peerTyping, scrollToBottom]);

  /**
   * Deliver due async-scheduled AI replies. Typing bubble only when
   * `showTyping` (scheduled delivery) — silent on mount / catch-up.
   */
  const pollPending = useCallback(
    async (options?: { showTyping?: boolean; force?: boolean }) => {
      if (!useSupabase) return;
      if (pollingRef.current) return;

      // Never hit the server before scheduled_at — early polls return empty and
      // used to kill the delivery timer (same nextPendingAt → effect no-op).
      if (!options?.force && nextPendingAt) {
        const msUntilDue = new Date(nextPendingAt).getTime() - Date.now();
        if (Number.isFinite(msUntilDue) && msUntilDue > 0) {
          return;
        }
      }

      pollingRef.current = true;
      const showTyping = options?.showTyping === true;
      if (showTyping) setPeerTyping(true);
      try {
        const res = await fetch(
          `/api/conversations/${encodeURIComponent(chatId)}/poll-pending`,
          {
            method: "POST",
            cache: "no-store",
            credentials: "same-origin",
            headers: appVariantFetchHeaders(variant),
          },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          ok?: boolean;
          newPeerMessages?: ChatMessage[];
          nextPendingAt?: string | null;
          hadDuePending?: boolean;
        };
        if (!data?.ok) return;
        const fresh = data.newPeerMessages ?? [];
        if (fresh.length > 0) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const additions = fresh
              .filter((m) => !seen.has(m.id))
              .map(withAmsterdamMessageTimes);
            return additions.length === 0 ? prev : [...prev, ...additions];
          });
          requestThreadsRefetch();
        }
        const nextAt = data.nextPendingAt ?? null;
        setNextPendingAt(nextAt);
        // Still waiting — re-arm timer if this poll was too early or raced.
        if (
          fresh.length === 0 &&
          nextAt &&
          new Date(nextAt).getTime() > Date.now()
        ) {
          setPendingScheduleKey((k) => k + 1);
        }
      } catch {
        /* network blip — next interaction will retry */
      } finally {
        pollingRef.current = false;
        stopPeerTyping();
      }
    },
    [chatId, useSupabase, stopPeerTyping, nextPendingAt, variant],
  );

  /**
   * Initial catch-up on mount: if the user opened the chat after a scheduled
   * reply was due, deliver it right now. This is what makes the persona feel
   * truly async — she "replied 20 minutes ago" lands the moment you open the
   * chat. Also seeds nextPendingAt for the timer effect below.
   */
  useEffect(() => {
    if (!useSupabase) return;
    void pollPending({ showTyping: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  /**
   * Arm delivery timers: show typing slightly early, poll only when due.
   */
  useEffect(() => {
    if (!nextPendingAt || !useSupabase) return;
    const target = new Date(nextPendingAt).getTime();
    if (!Number.isFinite(target)) return;

    const TYPING_LEAD_MS = 1200;
    let cancelled = false;
    let typingTimer: number | undefined;
    let pollTimer: number | undefined;

    const schedule = () => {
      if (cancelled) return;
      const msUntilDue = target - Date.now();

      if (msUntilDue <= 0) {
        setPeerTyping(true);
        void pollPending({ showTyping: true, force: true });
        return;
      }

      const msUntilTyping = msUntilDue - TYPING_LEAD_MS;
      if (msUntilTyping <= 0) {
        setPeerTyping(true);
      } else {
        typingTimer = window.setTimeout(() => {
          if (!cancelled) setPeerTyping(true);
        }, Math.min(msUntilTyping, 30 * 60_000));
      }

      const wakeForPoll = Math.min(Math.max(msUntilDue, 250), 30 * 60_000);
      pollTimer = window.setTimeout(() => {
        if (cancelled) return;
        if (Date.now() >= target) {
          void pollPending({ showTyping: true, force: true });
        } else {
          schedule();
        }
      }, wakeForPoll);
    };

    schedule();
    return () => {
      cancelled = true;
      if (typingTimer) window.clearTimeout(typingTimer);
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [nextPendingAt, pendingScheduleKey, pollPending, useSupabase]);

  /** Tab wake / return: deliver overdue replies the timer may have missed. */
  useEffect(() => {
    if (!useSupabase || !nextPendingAt) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const msUntilDue = new Date(nextPendingAt).getTime() - Date.now();
      if (Number.isFinite(msUntilDue) && msUntilDue <= 0) {
        void pollPending({ showTyping: true, force: true });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [nextPendingAt, pollPending, useSupabase]);

  const markReadOnServer = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/me/threads/${encodeURIComponent(chatId)}/read`,
        {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
        },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { ok?: boolean; count?: number };
      if (data?.ok && typeof data.count === "number") {
        // Sync the badge baseline straight from the server so we don't have
        // to wait for the next poll — this prevents the "ghost" red dot
        // briefly reappearing after returning from a chat.
        setServerUnreadBaseline(Math.max(0, Math.floor(data.count)));
      }
    } catch {
      /* network blip — polling will catch up */
    }
  }, [chatId]);

  /** Clear unread badge + bold styling as soon as this conversation is opened. */
  useEffect(() => {
    const o = getThreadPreviewOverride(chatId);
    // Don't surface brand-new empty chats in the inbox: only persist a preview
    // override (which the inbox uses to stub a row) when this thread already
    // has activity — either real messages on the server, or an existing
    // override carrying a real lastMessage. Pure "I just opened the chat"
    // visits with nothing to read should leave no trace.
    const hasRealActivity =
      initialMessages.length > 0 || (o?.lastMessage ?? "").trim().length > 0;

    if (!hasRealActivity) {
      // Nothing to mark, nothing to remember — but if the override somehow
      // exists from a previous visit, clear stale unread bookkeeping locally.
      if ((o?.unreadCount ?? 0) > 0) applyOptimisticUnreadDelta(-1);
      return;
    }

    const wasUnread = (o?.unreadCount ?? 0) > 0;
    // lastActivityAt = NOW guarantees this override is strictly newer than
    // anything the server returns later, so the inbox row never flips back
    // to bold while the read-POST is still in flight.
    setThreadPreview(chatId, {
      lastMessage: o?.lastMessage ?? "",
      timestampLabel: o?.timestampLabel ?? "",
      lastActivityAt: new Date().toISOString(),
      name: o?.name ?? meta.name,
      avatarUrl: o?.avatarUrl ?? meta.avatarUrl,
      verified: o?.verified ?? meta.verified,
      showOnlineDot: o?.showOnlineDot ?? false,
      unreadCount: 0,
    });
    if (wasUnread) applyOptimisticUnreadDelta(-1);
    void markReadOnServer();
    // Re-mark on unmount too, in case an AI reply arrived just before the
    // user navigated away (we want the chat to be fully "read" if they were
    // here, otherwise the unmount-time peer message would stay unread).
    return () => {
      void markReadOnServer();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  /**
   * Re-mark the thread as read whenever a new peer message arrives WHILE this
   * view is mounted. If the user navigates away before an AI reply lands,
   * this effect won't fire (component unmounted) and the message stays unread
   * on the server — so the bottom-nav badge + inbox bold styling appear.
   */
  const lastReadPeerIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.sender !== "peer") return;
    if (lastReadPeerIdRef.current === last.id) return;
    lastReadPeerIdRef.current = last.id;
    // Bump the override too so the inbox doesn't show a stale "unread" while
    // the user is actively reading new replies.
    const o = getThreadPreviewOverride(chatId);
    setThreadPreview(chatId, {
      ...o,
      lastMessage: o?.lastMessage ?? "",
      timestampLabel: o?.timestampLabel ?? "",
      lastActivityAt: new Date().toISOString(),
      unreadCount: 0,
    });
    void markReadOnServer();
  }, [messages, markReadOnServer, chatId]);

  const headerPresence = useMemo(
    () =>
      getChatHeaderPresence({
        messages,
        peerTyping,
        personaId: chatId,
        discoverBucket: meta.discoverPresenceBucket,
      }),
    [messages, peerTyping, chatId, meta.discoverPresenceBucket, onlineTick],
  );

  const liveOnlineNow = headerPresence.showGreenDot;

  /** If mock transcript missed SSR, merge saved first outbound (dev without Supabase). */
  useEffect(() => {
    if (useSupabase) return;
    try {
      const raw = localStorage.getItem("whisper_user");
      if (!raw) return;
      const u = JSON.parse(raw) as {
        pickedMatchId?: string;
        firstMessage?: string;
      };
      if (u.pickedMatchId !== chatId || !u.firstMessage?.trim()) return;
      setMessages((prev) => {
        const body = u.firstMessage!.trim();
        if (prev.some((m) => m.sender === "me" && m.body === body)) return prev;
        const { timeLabel, minuteOfDay } = nowAmsterdamClock();
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

  /** Fetch persisted thread from API and merge — never wipe optimistic rows. */
  const syncMessagesFromServer = useCallback(
    async (signal?: AbortSignal) => {
      if (!useSupabase) return;
      try {
        const res = await fetch(
          `/api/conversations/${encodeURIComponent(chatId)}/messages`,
          {
            cache: "no-store",
            signal,
            headers: appVariantFetchHeaders(variant),
          },
        );
        const data = (await res.json()) as {
          ok?: boolean;
          messages?: ChatMessage[];
          nextPendingAt?: string | null;
        };
        if (!res.ok || !data.ok || !Array.isArray(data.messages)) return;
        const server = data.messages.map(withAmsterdamMessageTimes);
        setMessages((prev) => {
          const merged = mergeChatMessages(prev, server);
          const hadNewPeer = merged.some(
            (m) => m.sender === "peer" && !prev.some((p) => p.id === m.id),
          );
          if (hadNewPeer) requestThreadsRefetch();
          return merged;
        });
        setSkipEntryAnimateIds((prev) => {
          const next = new Set(prev);
          for (const m of server) next.add(m.id);
          return next;
        });
        if (data.nextPendingAt) {
          setNextPendingAt(data.nextPendingAt);
        }
      } catch {
        /* keep current state */
      }
    },
    [chatId, useSupabase, variant],
  );

  /** Initial server sync on mount / chat change. */
  useEffect(() => {
    if (!useSupabase) return;
    const ctrl = new AbortController();
    void syncMessagesFromServer(ctrl.signal);
    return () => ctrl.abort();
  }, [chatId, useSupabase, syncMessagesFromServer]);

  /**
   * Live delivery while THIS chat is open. The app-shell heartbeat (every 30s)
   * processes pending replies server-side and dispatches WHISPER_THREADS_REFETCH;
   * we piggyback on that signal to pull fresh peer messages for the open thread.
   * Also poll every 15s as a safety net for tabs without focus events.
   */
  useEffect(() => {
    if (!useSupabase) return;
    const onRefetch = () => void syncMessagesFromServer();
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncMessagesFromServer();
    };
    const onFocus = () => void syncMessagesFromServer();
    window.addEventListener(WHISPER_THREADS_REFETCH, onRefetch);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void syncMessagesFromServer();
    }, 15_000);
    return () => {
      window.removeEventListener(WHISPER_THREADS_REFETCH, onRefetch);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.clearInterval(interval);
    };
  }, [useSupabase, syncMessagesFromServer]);

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
      if (useSupabase) {
        const bal = getCreditsSnapshot().balance;
        if (bal < CHAT_MESSAGE_COST_CREDITS) {
          openCreditsGate();
          return;
        }
      }

      if (!useSupabase) {
        const { timeLabel, minuteOfDay } = nowAmsterdamClock();
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
          showOnlineDot: liveOnlineNow,
          unreadCount: 0,
        });
        return;
      }

      if (sendTextInFlightRef.current) return;
      sendTextInFlightRef.current = true;

      const sentAt = new Date().toISOString();
      const { timeLabel, minuteOfDay } = nowAmsterdamClock();
      const tempId = `tmp-${gid()}`;
      const optimisticUserMessage: ChatMessage = {
        id: tempId,
        sender: "me",
        kind: "text",
        body: trimmed,
        timeLabel,
        minuteOfDay,
        createdAt: sentAt,
      };

      setAssistantError(null);
      setInput("");
      setMessages((prev) => [...prev, optimisticUserMessage]);
      setReadPhase((p) => ({ ...p, [tempId]: "single" }));
      setThreadPreview(chatId, {
        lastMessage: trimmed,
        timestampLabel: timeLabel,
        lastActivityAt: sentAt,
        name: meta.name,
        avatarUrl: meta.avatarUrl,
        verified: meta.verified,
        showOnlineDot: liveOnlineNow,
        unreadCount: 0,
      });

      try {
        const res = await fetch(
          `/api/conversations/${encodeURIComponent(chatId)}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...appVariantFetchHeaders(variant),
            },
            body: JSON.stringify({ text: trimmed }),
          },
        );
        const data = (await res.json()) as {
          ok?: boolean;
          userMessage?: ChatMessage;
          peerMessage?: ChatMessage | null;
          newPeerMessages?: ChatMessage[];
          nextPendingAt?: string | null;
          newBalance?: number;
          warning?: string;
          error?: string;
        };

        if (!res.ok || !data.userMessage) {
          console.error("[chat]", data.error ?? res.status);
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          setReadPhase((p) => {
            if (!(tempId in p)) return p;
            const { [tempId]: _, ...rest } = p;
            return rest;
          });
          setInput(trimmed);
          if (res.status === 402) {
            openCreditsGate();
            return;
          }
          setAssistantError(
            typeof data.error === "string"
              ? data.error
              : `Versturen mislukt (${res.status})`,
          );
          return;
        }

        if (typeof data.newBalance === "number") {
          applyServerCreditsUpdate(data.newBalance);
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

        setMessages((prev) =>
          finalizeMessagesAfterSend(prev, tempId, data.userMessage!, {
            newPeerMessages: data.newPeerMessages,
            peerMessage: data.peerMessage,
          }),
        );
        // Arm the next async delivery if the server scheduled one.
        setNextPendingAt(data.nextPendingAt ?? null);

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
          timestampLabel: nowAmsterdamClock().timeLabel,
          lastActivityAt: new Date().toISOString(),
          name: meta.name,
          avatarUrl: meta.avatarUrl,
          verified: meta.verified,
          showOnlineDot: liveOnlineNow,
        });
        requestThreadsRefetch();
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
      } finally {
        sendTextInFlightRef.current = false;
      }
    },
    [chatId, openCreditsGate, useSupabase, meta, variant],
  );

  const sendImage = useCallback(
    async (publicUrl: string) => {
      if (!publicUrl) return;
      if (useSupabase) {
        const bal = getCreditsSnapshot().balance;
        if (bal < CHAT_MESSAGE_COST_CREDITS) {
          openCreditsGate();
          return;
        }
      }
      if (!useSupabase) {
        const { timeLabel, minuteOfDay } = nowAmsterdamClock();
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

      const { timeLabel, minuteOfDay } = nowAmsterdamClock();
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
        showOnlineDot: liveOnlineNow,
        unreadCount: 0,
      });

      try {
        const res = await fetch(
          `/api/conversations/${encodeURIComponent(chatId)}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...appVariantFetchHeaders(variant),
            },
            body: JSON.stringify({ imageUrl: publicUrl }),
          },
        );
        const data = (await res.json()) as {
          ok?: boolean;
          userMessage?: ChatMessage;
          peerMessage?: ChatMessage | null;
          newPeerMessages?: ChatMessage[];
          nextPendingAt?: string | null;
          newBalance?: number;
          warning?: string;
          error?: string;
        };
        if (!res.ok || !data.userMessage) {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          if (res.status === 402) {
            openCreditsGate();
            return;
          }
          setAssistantError(data.error ?? `Foto versturen mislukt (${res.status})`);
          return;
        }
        if (typeof data.newBalance === "number") {
          applyServerCreditsUpdate(data.newBalance);
        }
        setMessages((prev) =>
          finalizeMessagesAfterSend(prev, tempId, data.userMessage!, {
            newPeerMessages: data.newPeerMessages,
            peerMessage: data.peerMessage,
          }),
        );
        setNextPendingAt(data.nextPendingAt ?? null);
        requestThreadsRefetch();
      } catch (e) {
        console.error("[chat] send image failed", e);
        setAssistantError(
          e instanceof Error ? e.message : "Foto versturen mislukt",
        );
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
      }
    },
    [chatId, openCreditsGate, useSupabase, meta, variant],
  );

  const sendGift = useCallback(
    async (amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false as const, error: "Ongeldig bedrag" };

      const { timeLabel, minuteOfDay } = nowAmsterdamClock();
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
        showOnlineDot: liveOnlineNow,
        unreadCount: 0,
      });

      try {
        const res = await fetch(
          `/api/conversations/${encodeURIComponent(chatId)}/gifts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...appVariantFetchHeaders(variant),
            },
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
        setMessages((prev) =>
          finalizeMessagesAfterSend(prev, tempId, data.userMessage!, {
            peerMessage: data.peerMessage,
          }),
        );
        requestThreadsRefetch();
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
    [chatId, meta, variant],
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
          <p
            className={`mt-0.5 flex items-center gap-1.5 text-[12px] ${
              headerPresence.variant === "online" ||
              headerPresence.variant === "typing"
                ? "text-primary"
                : "text-inkMuted"
            }`}
          >
            {headerPresence.showGreenDot && (
              <span
                className={`h-2 w-2 shrink-0 rounded-full bg-accentGreen shadow-[0_0_0_2px_rgba(124,92,255,0.12)] ${
                  headerPresence.variant === "typing" ? "animate-pulse" : ""
                }`}
              />
            )}
            <span
              className={
                headerPresence.variant === "online" ||
                headerPresence.variant === "typing"
                  ? "font-medium"
                  : "font-normal"
              }
            >
              {headerPresence.label}
            </span>
          </p>
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
                    href={withVariantPath(`/profile/${chatId}`, variant)}
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
                              <>
                                {msg.blurCost && msg.blurCost > 0 && !unlockedBlurred[msg.id] ? (
                                  <div className="relative">
                                    <Image
                                      src={msg.imageUrl}
                                      alt=""
                                      width={600}
                                      height={400}
                                      className="h-auto w-full object-cover blur-[14px] brightness-75"
                                    />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                                      <div className="rounded-full bg-white/95 px-4 py-1 text-[13px] font-semibold text-ink shadow">
                                        Expliciete foto
                                      </div>
                                      <button
                                        type="button"
                                        disabled={!!unlockBusy[msg.id]}
                                        onClick={async () => {
                                          setUnlockBusy((b) => ({ ...b, [msg.id]: true }));
                                          try {
                                            const r = await fetch("/api/chat/unlock-photo", {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ messageId: msg.id }),
                                            });
                                            const j = await r.json();
                                            if (j.ok) {
                                              setUnlockedBlurred((u) => ({ ...u, [msg.id]: true }));
                                            } else {
                                              alert(j.error || "Ontgrendelen mislukt");
                                            }
                                          } finally {
                                            setUnlockBusy((b) => {
                                              const n = { ...b };
                                              delete n[msg.id];
                                              return n;
                                            });
                                          }
                                        }}
                                        className="mt-2 rounded-full bg-primary px-5 py-1.5 text-[13px] font-bold text-white shadow active:scale-[0.985]"
                                      >
                                        {unlockBusy[msg.id] ? "Bezig..." : `Ontgrendel voor ${msg.blurCost} credits`}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <Image
                                    src={msg.imageUrl}
                                    alt=""
                                    width={600}
                                    height={400}
                                    className="h-auto w-full object-cover"
                                  />
                                )}
                              </>
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
                          read={Boolean(msg.peerReadAt)}
                        />
                      </p>
                    )}
                    {msg.id === lastReadUserMessageId && msg.peerReadAt && (
                      <p className="mt-0.5 pr-0.5 text-right text-[10px] font-medium text-primary">
                        Gelezen {formatReadTimeAmsterdam(msg.peerReadAt)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
          <AnimatePresence>
            {peerTyping && (
              <PeerTypingBubble avatarUrl={meta.avatarUrl} />
            )}
          </AnimatePresence>
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
              className="h-12 w-full rounded-full border-0 bg-white px-4 text-[15px] text-ink shadow-card ring-1 ring-black/[0.06] outline-none transition placeholder:text-inkMuted focus:ring-2 focus:ring-primary/35"
            />
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

      <AnimatePresence>
        {creditsGateOpen && (
          <>
            <motion.div
              key="credits-gate-bg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-sm"
              onClick={() => setCreditsGateOpen(false)}
            />
            <motion.div
              key="credits-gate-sheet"
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "tween", duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
              className="fixed inset-x-0 bottom-0 z-[85] mx-auto max-w-[430px] rounded-t-3xl bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
              role="dialog"
              aria-labelledby="credits-gate-title"
              aria-modal="true"
            >
              <motion.div className="mb-4 flex justify-center sm:hidden">
                <div className="h-1 w-10 rounded-full bg-gray-200" />
              </motion.div>

              <div className="flex flex-col items-center text-center">
                <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-md">
                  <Coins className="h-7 w-7" strokeWidth={2.25} aria-hidden />
                </span>
                <h2
                  id="credits-gate-title"
                  className="text-[18px] font-extrabold text-ink"
                >
                  Credits op
                </h2>
                <p className="mt-1.5 max-w-[28ch] text-[13px] leading-snug text-gray-600">
                  Je hebt niet genoeg credits om een bericht te sturen (
                  {CHAT_MESSAGE_COST_CREDITS} per bericht). Koop extra credits om
                  het gesprek voort te zetten.
                </p>
              </div>

              <Link
                href={withVariantPath("/credits", variant)}
                onClick={() => setCreditsGateOpen(false)}
                className="mt-5 flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] py-3.5 text-[15px] font-extrabold text-white shadow-lg transition active:scale-[0.98]"
              >
                Credits kopen
              </Link>
              <button
                type="button"
                onClick={() => setCreditsGateOpen(false)}
                className="mt-2 w-full py-2.5 text-[13px] font-semibold text-gray-500"
              >
                Niet nu
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
