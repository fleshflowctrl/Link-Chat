import { TelegramSetupCard } from "@/components/admin/telegram-setup-card";

export const dynamic = "force-dynamic";

export default function AdminTelegramPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">Telegram operator</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Ontvang user-berichten in Telegram en antwoord met reply. Werkt naast{" "}
          <a href="/operator/inbox" className="text-rose-400 underline">
            Operator inbox
          </a>
          .
        </p>
      </div>
      <TelegramSetupCard />
    </div>
  );
}
