import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  loadAdminUserThreads,
  type AdminThreadSummary,
} from "@/lib/admin/chat-threads";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ChatBubbleIcon } from "@/components/admin/icons";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function AdminUserMessagesPage({
  params,
}: {
  params: { ownerId: string };
}) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) {
      redirect(`/login?next=/admin/messages/${params.ownerId}`);
    }
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-lg font-semibold">Geen toegang</h1>
        <p className="mt-1 text-sm">{auth.error}</p>
      </div>
    );
  }

  const service = getServiceSupabase();
  if (!service) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Service-role key ontbreekt — kan gesprekken niet ophalen.
      </div>
    );
  }

  const { ownerId } = params;
  let threads: AdminThreadSummary[] = [];
  let loadError: string | null = null;
  try {
    threads = await loadAdminUserThreads(service, ownerId);
  } catch (e) {
    threads = [];
    loadError = e instanceof Error ? e.message : "Laden mislukt";
  }

  let ownerEmail = threads[0]?.ownerEmail ?? null;
  if (!ownerEmail) {
    const { data } = await service.auth.admin.getUserById(ownerId);
    ownerEmail = data?.user?.email ?? null;
  }
  const ownerLabel = ownerEmail ?? `${ownerId.slice(0, 8)}…`;
  const totalMessages = threads.reduce((n, t) => n + t.messageCount, 0);

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        crumbs={[
          { label: "Admin" },
          { label: "Berichten", href: "/admin/messages" },
          { label: ownerLabel },
        ]}
        title={ownerLabel}
        description={
          <>
            Gesprekken van deze gebruiker.{" "}
            <span className="text-gray-500">
              ({threads.length} gesprek{threads.length === 1 ? "" : "ken"},{" "}
              {totalMessages} berichten verstuurd)
            </span>
          </>
        }
      />

      {loadError ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {loadError}
        </div>
      ) : null}

      {threads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <ChatBubbleIcon className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">Geen gesprekken</p>
          <p className="mt-1 text-xs text-gray-500">
            Deze gebruiker heeft nog geen berichten verstuurd.
          </p>
          <Link
            href="/admin/messages"
            className="mt-4 text-sm font-medium text-primary hover:underline"
          >
            ← Terug naar gebruikers
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          {threads.map((t) => (
            <li key={t.peerId}>
              <Link
                href={`/admin/messages/${ownerId}/${t.peerId}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-100 ring-1 ring-black/5">
                  {t.peerAvatarUrl ? (
                    <Image
                      src={t.peerAvatarUrl}
                      alt={t.peerName}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {t.peerName}
                    </p>
                    <span className="shrink-0 text-xs text-gray-500">
                      {formatDateTime(t.lastMessageAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-gray-600">
                    <span className="font-medium text-gray-500">
                      {t.lastSender === "me" ? "User: " : `${t.peerName}: `}
                    </span>
                    {t.lastMessagePreview}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {t.messageCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
