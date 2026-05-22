"use client";

import { useCallback, useEffect, useState } from "react";

type SetupStatus = {
  ok: boolean;
  configured?: boolean;
  operatorChatIds?: number[];
  webhookUrl?: string;
  hasWebhookSecret?: boolean;
  webhook?: {
    url: string;
    pending_update_count: number;
    last_error_message?: string;
  } | null;
  webhookError?: string | null;
  error?: string;
};

export function TelegramSetupCard() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/telegram/setup");
      const json = (await res.json()) as SetupStatus;
      setStatus(json);
    } catch {
      setStatus({ ok: false, error: "Kon status niet laden" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setWebhook() {
    setActionMsg(null);
    const res = await fetch("/api/admin/telegram/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set" }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    setActionMsg(json.ok ? "Webhook ingesteld." : (json.error ?? "Mislukt"));
    await load();
  }

  async function deleteWebhook() {
    setActionMsg(null);
    const res = await fetch("/api/admin/telegram/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    setActionMsg(json.ok ? "Webhook verwijderd." : (json.error ?? "Mislukt"));
    await load();
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-400">
        Laden…
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-sm text-zinc-300">
      <section className="space-y-2">
        <h2 className="font-medium text-zinc-100">Stappen</h2>
        <ol className="list-decimal space-y-2 pl-5 text-zinc-400">
          <li>
            Maak een bot via{" "}
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noreferrer"
              className="text-rose-400 underline"
            >
              @BotFather
            </a>{" "}
            → <code className="text-zinc-300">/newbot</code> → kopieer token naar{" "}
            <code className="text-zinc-300">TELEGRAM_BOT_TOKEN</code>.
          </li>
          <li>
            Start een chat met je bot → stuur <code className="text-zinc-300">/start</code>{" "}
            (ook als chat-id nog niet in env staat; je ziet je id in het antwoord).
          </li>
          <li>
            Zet <code className="text-zinc-300">TELEGRAM_OPERATOR_CHAT_IDS</code> op die
            chat-id (komma voor meerdere).
          </li>
          <li>
            Optioneel: <code className="text-zinc-300">TELEGRAM_WEBHOOK_SECRET</code>{" "}
            (willekeurige string) + zelfde op Vercel.
          </li>
          <li>
            Run migratie <code className="text-zinc-300">20260522130000_chat_operator_telegram_map.sql</code>{" "}
            in Supabase.
          </li>
          <li>
            Productie: klik hieronder <strong>Webhook instellen</strong> (HTTPS vereist).
            Lokaal: gebruik ngrok naar <code className="text-zinc-300">/api/telegram/webhook</code>.
          </li>
        </ol>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium text-zinc-100">Status</h2>
        {status?.error && (
          <p className="text-amber-400">{status.error}</p>
        )}
        <ul className="space-y-1 text-zinc-400">
          <li>
            Operator geconfigureerd:{" "}
            <span className={status?.configured ? "text-emerald-400" : "text-amber-400"}>
              {status?.configured ? "ja" : "nee (token + chat-id)"}
            </span>
          </li>
          <li>
            Chat-ids:{" "}
            {status?.operatorChatIds?.length
              ? status.operatorChatIds.join(", ")
              : "—"}
          </li>
          <li>
            Webhook URL: <code className="text-zinc-300">{status?.webhookUrl ?? "—"}</code>
          </li>
          <li>
            Telegram webhook actief:{" "}
            {status?.webhook?.url ? (
              <span className="text-emerald-400">{status.webhook.url}</span>
            ) : (
              <span className="text-amber-400">nog niet</span>
            )}
          </li>
          {status?.webhook?.last_error_message && (
            <li className="text-red-400">
              Laatste fout: {status.webhook.last_error_message}
            </li>
          )}
          {status?.webhookError && (
            <li className="text-red-400">{status.webhookError}</li>
          )}
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void setWebhook()}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
        >
          Webhook instellen
        </button>
        <button
          type="button"
          onClick={() => void deleteWebhook()}
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Webhook verwijderen
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Vernieuwen
        </button>
      </div>

      {actionMsg && <p className="text-zinc-400">{actionMsg}</p>}
    </div>
  );
}
