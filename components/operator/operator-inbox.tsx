"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "@/data/messages";

type InboxItem = {
  conversationId: string;
  peerDisplayName: string;
  peerAvatarUrl: string;
  userEmail: string | null;
  lastMessagePreview: string | null;
  lastUserMessageAt: string | null;
  unreadForOperator: boolean;
  status: string;
};

type ThreadDetail = {
  conversationId: string;
  peer: { display_name: string; avatar_url: string };
  ownerEmail: string | null;
  messages: ChatMessage[];
  memorySummary: string | null;
  queue: { operator_status: string } | null;
};

function formatRel(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("nl-NL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}


export function OperatorInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [replyText, setReplyText] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showThreadPanel = Boolean(selectedId && detail);
  const showListOnMobile = !showThreadPanel;

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
    setSuggestion(null);
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
      ownerEmail: data.ownerEmail,
      messages: data.messages,
      memorySummary: data.memorySummary,
      queue: data.queue,
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

  function selectConversation(id: string) {
    setSelectedId(id);
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
    setSuggestion(null);
    await loadThread(selectedId);
    await loadInbox();
  }

  async function fetchSuggestion() {
    if (!selectedId) return;
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
    setSuggestion(data.suggestion ?? null);
    if (data.suggestion) setReplyText(data.suggestion);
  }

  function backToList() {
    setSelectedId(null);
    setDetail(null);
    setSuggestion(null);
    setError(null);
  }

  async function markClosed() {
    if (!selectedId) return;
    await fetch(`/api/operator/conversations/${selectedId}/close`, {
      method: "POST",
    });
    await loadInbox();
    backToList();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm lg:min-h-[520px] lg:max-h-[calc(100dvh-10rem)] lg:flex-row lg:rounded-2xl">
      {/* Inbox list — full width on phone when no thread open */}
      <aside
        className={`flex min-h-0 flex-1 flex-col border-neutral-200 lg:w-full lg:max-w-sm lg:shrink-0 lg:border-r ${
          showListOnMobile ? "flex" : "hidden"
        } lg:flex`}
      >
        <div className="shrink-0 border-b border-neutral-100 px-3 py-3 sm:px-4">
          <h2 className="text-sm font-semibold text-neutral-900">Wacht op antwoord</h2>
          <p className="text-xs text-neutral-500">{items.length} gesprekken</p>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {items.map((item) => (
            <li key={item.conversationId}>
              <button
                type="button"
                onClick={() => selectConversation(item.conversationId)}
                className={`flex w-full gap-3 px-3 py-3.5 text-left active:bg-neutral-100 sm:px-4 ${
                  selectedId === item.conversationId
                    ? "bg-primary/5"
                    : "hover:bg-neutral-50"
                }`}
              >
                <Image
                  src={item.peerAvatarUrl || "/placeholder-avatar.png"}
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-neutral-900">
                      {item.peerDisplayName}
                    </span>
                    {item.unreadForOperator && (
                      <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-white">
                        nieuw
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-neutral-500">
                    {item.userEmail ?? "user"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-600">
                    {item.lastMessagePreview ?? "—"}
                  </p>
                  <p className="text-[10px] text-neutral-400">
                    {formatRel(item.lastUserMessageAt)}
                  </p>
                </div>
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-4 py-12 text-center text-sm text-neutral-500">
              Geen open gesprekken
            </li>
          )}
        </ul>
      </aside>

      {/* Thread — full screen on phone when selected */}
      <section
        className={`min-h-0 flex-1 flex-col ${
          showThreadPanel ? "flex" : "hidden"
        } lg:flex`}
      >
        {!detail ? (
          <div className="hidden flex-1 items-center justify-center p-6 text-sm text-neutral-500 lg:flex">
            Kies een gesprek in de lijst
          </div>
        ) : (
          <>
            <header className="flex shrink-0 items-start gap-2 border-b border-neutral-100 px-3 py-3 sm:px-4">
              <button
                type="button"
                onClick={backToList}
                className="lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-700 active:bg-neutral-100"
                aria-label="Terug naar inbox"
              >
                <span className="text-xl leading-none" aria-hidden>
                  ←
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold sm:text-base">
                  {detail.peer.display_name}
                </h2>
                <p className="truncate text-xs text-neutral-500">
                  {detail.ownerEmail ?? "—"} · {detail.queue?.operator_status ?? "—"}
                </p>
                {detail.memorySummary && (
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-600">
                    {detail.memorySummary}
                  </p>
                )}
              </div>
            </header>

            <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
              {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-neutral-600">
                  Laden…
                </div>
              )}
              <div className="space-y-2 pb-2">
                {detail.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[min(85%,20rem)] rounded-2xl px-3 py-2.5 text-sm leading-snug ${
                      m.sender === "peer"
                        ? "ml-auto bg-primary/10 text-neutral-900"
                        : "mr-auto bg-neutral-100 text-neutral-800"
                    }`}
                  >
                    <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                      {m.sender === "peer" ? detail.peer.display_name : "User"}
                    </span>
                    <span className="break-words">
                      {m.body ?? (m.kind === "image" ? "[afbeelding]" : "")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {suggestion && (
              <p className="shrink-0 mx-3 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:mx-4">
                AI-suggestie — bewerk en tik op Versturen.
              </p>
            )}

            <footer className="shrink-0 border-t border-neutral-100 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
                placeholder={`Antwoord als ${detail.peer.display_name}…`}
                className="mb-2 w-full resize-none rounded-xl border border-neutral-200 px-3 py-2.5 text-base sm:text-sm"
              />
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  disabled={loading || !replyText.trim()}
                  onClick={() => void sendReply()}
                  className="min-h-[44px] w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
                >
                  Versturen als {detail.peer.display_name}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void fetchSuggestion()}
                  className="min-h-[44px] w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium active:bg-neutral-50 sm:w-auto"
                >
                  AI suggestie
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void markClosed()}
                  className="min-h-[44px] w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-600 active:bg-neutral-50 sm:w-auto"
                >
                  Afsluiten
                </button>
              </div>
            </footer>
          </>
        )}
        {error && (
          <p className="shrink-0 border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800 sm:px-4">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
