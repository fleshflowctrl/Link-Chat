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
    setError(null);
  }, []);

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

  async function markClosed() {
    if (!selectedId) return;
    await fetch(`/api/operator/conversations/${selectedId}/close`, {
      method: "POST",
    });
    await loadInbox();
    setSelectedId(null);
    setDetail(null);
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[480px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <aside className="w-full max-w-sm shrink-0 border-r border-neutral-200 flex flex-col">
        <div className="border-b border-neutral-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-900">Wacht op antwoord</h2>
          <p className="text-xs text-neutral-500">{items.length} gesprekken</p>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {items.map((item) => (
            <li key={item.conversationId}>
              <button
                type="button"
                onClick={() => setSelectedId(item.conversationId)}
                className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-neutral-50 ${
                  selectedId === item.conversationId ? "bg-primary/5" : ""
                }`}
              >
                <Image
                  src={item.peerAvatarUrl || "/placeholder-avatar.png"}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-neutral-900">
                      {item.peerDisplayName}
                    </span>
                    {item.unreadForOperator && (
                      <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-white">
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
            <li className="px-4 py-8 text-center text-sm text-neutral-500">
              Geen open gesprekken
            </li>
          )}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {!detail ? (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
            Kies een gesprek links
          </div>
        ) : (
          <>
            <header className="border-b border-neutral-100 px-4 py-3">
              <h2 className="text-sm font-semibold">{detail.peer.display_name}</h2>
              <p className="text-xs text-neutral-500">
                User: {detail.ownerEmail ?? "—"} · status:{" "}
                {detail.queue?.operator_status ?? "—"}
              </p>
              {detail.memorySummary && (
                <p className="mt-2 line-clamp-2 text-xs text-neutral-600">
                  Memory: {detail.memorySummary}
                </p>
              )}
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {detail.messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.sender === "peer"
                      ? "ml-auto bg-primary/10 text-neutral-900"
                      : "bg-neutral-100 text-neutral-800"
                  }`}
                >
                  <span className="mb-0.5 block text-[10px] font-medium uppercase text-neutral-400">
                    {m.sender === "peer" ? detail.peer.display_name : "User"}
                  </span>
                  {m.body ?? (m.kind === "image" ? "[afbeelding]" : "")}
                </div>
              ))}
            </div>
            {suggestion && (
              <p className="mx-4 mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                AI-suggestie (nog niet verzonden): bewerk en klik Send.
              </p>
            )}
            <footer className="border-t border-neutral-100 p-4 space-y-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={3}
                placeholder={`Antwoord als ${detail.peer.display_name}…`}
                className="w-full resize-none rounded-xl border border-neutral-200 px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading || !replyText.trim()}
                  onClick={() => void sendReply()}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Send as {detail.peer.display_name}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void fetchSuggestion()}
                  className="rounded-xl border border-neutral-200 px-4 py-2 text-sm"
                >
                  AI suggestie
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void markClosed()}
                  className="rounded-xl border border-neutral-200 px-4 py-2 text-sm text-neutral-600"
                >
                  Mark closed
                </button>
              </div>
            </footer>
          </>
        )}
        {error && (
          <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-800">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
