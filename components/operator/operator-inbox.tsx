"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, MoreHorizontal, User } from "lucide-react";
import type { ChatMessage } from "@/data/messages";

type InboxItem = {
  conversationId: string;
  peerDisplayName: string;
  ownerDisplayName: string;
  ownerPhotoUrl: string;
  userEmail: string | null;
  lastMessagePreview: string | null;
  lastUserMessageAt: string | null;
  unreadForOperator: boolean;
};

type ThreadDetail = {
  conversationId: string;
  peer: { display_name: string; avatar_url: string };
  ownerDisplayName: string;
  ownerPhotoUrl: string;
  ownerEmail: string | null;
  messages: ChatMessage[];
};

function formatRel(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    size === "lg"
      ? "h-12 w-12"
      : size === "sm"
        ? "h-8 w-8"
        : "h-10 w-10";
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
        className={size === "lg" ? "h-6 w-6" : size === "sm" ? "h-4 w-4" : "h-5 w-5"}
        strokeWidth={2}
      />
    </span>
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const inThread = Boolean(selectedId && detail);

  const loadInbox = useCallback(async () => {
    const res = await fetch("/api/operator/conversations");
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

  const loadThread = useCallback(async (conversationId: string) => {
    setLoading(true);
    const res = await fetch(`/api/operator/conversations/${conversationId}`);
    const data = (await res.json()) as ThreadDetail & { ok: boolean; error?: string };
    setLoading(false);
    if (!data.ok) {
      setError(data.error ?? "Gesprek laden mislukt");
      return;
    }
    setDetail({
      conversationId: data.conversationId,
      peer: data.peer,
      ownerDisplayName: data.ownerDisplayName,
      ownerPhotoUrl: data.ownerPhotoUrl,
      ownerEmail: data.ownerEmail,
      messages: data.messages,
    });
    setError(null);
  }, []);

  useEffect(() => {
    void loadInbox();
    const t = setInterval(() => void loadInbox(), 15_000);
    return () => clearInterval(t);
  }, [loadInbox]);

  useEffect(() => {
    if (selectedId) void loadThread(selectedId);
  }, [selectedId, loadThread]);

  useEffect(() => {
    if (inThread) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
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

  return (
    <div className="flex min-h-0 min-h-dvh flex-1 flex-col overflow-hidden lg:min-h-0 lg:flex-row">
      {/* Inbox list */}
      {!inThread && (
        <div className="flex min-h-0 flex-1 flex-col bg-white lg:max-w-sm lg:shrink-0 lg:border-r lg:border-neutral-200">
          <div className="shrink-0 border-b border-neutral-200 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-neutral-900">Gesprekken</h2>
              <Link
                href="/admin"
                className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
              >
                Admin
              </Link>
            </div>
            <p className="text-xs text-neutral-500">{items.length} open</p>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {items.map((item) => (
              <li key={item.conversationId}>
                <button
                  type="button"
                  onClick={() => selectConversation(item.conversationId)}
                  className="flex w-full gap-3 border-b border-neutral-50 px-4 py-3.5 text-left active:bg-neutral-50"
                >
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
                    <p className="truncate text-xs text-neutral-500">
                      → {item.peerDisplayName}
                      {item.userEmail ? ` · ${item.userEmail}` : ""}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-neutral-600">
                      {item.lastMessagePreview ?? "—"}
                    </p>
                  </div>
                  {item.unreadForOperator && (
                    <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              </li>
            ))}
            {items.length === 0 && (
              <li className="px-4 py-16 text-center text-sm text-neutral-500">
                Geen open gesprekken
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Full-screen chat */}
      {inThread && detail && (
        <div className="fixed inset-0 z-50 flex min-h-0 flex-col bg-[#f0f0f0] lg:relative lg:inset-auto lg:z-auto lg:min-h-0 lg:flex-1">
          <header className="flex shrink-0 items-center gap-2 border-b border-neutral-200/80 bg-white px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] shadow-sm">
            <button
              type="button"
              onClick={backToList}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-800 active:bg-neutral-100"
              aria-label="Terug naar gesprekken"
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={2} />
            </button>
            <Avatar
              src={detail.ownerPhotoUrl}
              alt={detail.ownerDisplayName}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight text-neutral-900">
                {detail.ownerDisplayName}
              </p>
              <p className="truncate text-xs text-neutral-500">
                Jij antwoordt als {detail.peer.display_name}
              </p>
            </div>
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
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] rounded-xl border border-neutral-200 bg-white py-1 shadow-lg">
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
          </header>

          <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
            {loading && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#f0f0f0]/60 text-sm text-neutral-600">
                Laden…
              </div>
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
                    <div
                      className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug shadow-sm ${
                        isPeer
                          ? "rounded-br-md bg-primary text-white"
                          : "rounded-bl-md bg-white text-neutral-900"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {m.body ?? (m.kind === "image" ? "[afbeelding]" : "")}
                      </p>
                    </div>
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

          <footer className="shrink-0 border-t border-neutral-200/80 bg-white p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
                className="flex h-11 min-w-[4.5rem] shrink-0 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                Stuur
              </button>
            </div>
          </footer>
        </div>
      )}

      {/* Desktop empty state when no thread */}
      {!inThread && (
        <div className="hidden flex-1 items-center justify-center bg-neutral-100 text-sm text-neutral-500 lg:flex">
          Kies een gesprek
        </div>
      )}
    </div>
  );
}
