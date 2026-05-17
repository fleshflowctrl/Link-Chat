import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  loadAdminThreadDetail,
  type AdminThreadDetail,
} from "@/lib/admin/chat-threads";
import { AdminPageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function AdminThreadDetailPage({
  params,
}: {
  params: { ownerId: string; peerId: string };
}) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) {
      redirect(
        `/login?next=/admin/messages/${params.ownerId}/${params.peerId}`,
      );
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
        Service-role key ontbreekt — kan berichten niet ophalen.
      </div>
    );
  }

  const { ownerId, peerId } = params;

  let detail: AdminThreadDetail | null = null;
  let loadError: string | null = null;
  try {
    detail = await loadAdminThreadDetail(service, ownerId, peerId);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Laden mislukt";
    detail = null;
  }

  if (loadError || !detail) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
          {loadError ?? "Gesprek niet gevonden"}
        </div>
        <Link
          href={`/admin/messages/${ownerId}`}
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          ← Terug naar gesprekken
        </Link>
      </div>
    );
  }

  const { peer, messages, ownerEmail } = detail;
  const ownerLabel = ownerEmail ?? `${ownerId.slice(0, 8)}…`;

  return (
    <div className="mx-auto max-w-5xl">
      <AdminPageHeader
        crumbs={[
          { label: "Admin" },
          { label: "Berichten", href: "/admin/messages" },
          { label: ownerLabel, href: `/admin/messages/${ownerId}` },
          { label: peer.name },
        ]}
        title={peer.name}
        description={
          <>
            Gesprek met{" "}
            <span className="font-medium text-gray-900">{ownerLabel}</span>
            {" · "}
            {messages.length} berichten
          </>
        }
      />

      <div className="flex items-center gap-4 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="relative h-14 w-14 overflow-hidden rounded-full bg-gray-100 ring-1 ring-black/5">
          {peer.avatarUrl ? (
            <Image
              src={peer.avatarUrl}
              alt={peer.name}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold tracking-tight">
            {peer.name}
          </p>
          <p className="mt-0.5 text-sm text-gray-600">
            Gebruiker:{" "}
            <span className="font-medium text-gray-900">{ownerLabel}</span>
          </p>
        </div>
        <Link
          href={`/admin/messages/${ownerId}`}
          className="shrink-0 rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
        >
          Andere gesprekken
        </Link>
      </div>

      <div className="mt-6 space-y-3">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600">
            Geen berichten in dit gesprek.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender === "me";
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-[15px] leading-snug shadow-sm ${
                    mine
                      ? "bg-[#7C5CFF] text-white"
                      : "border border-black/5 bg-white text-gray-900"
                  }`}
                >
                  {m.kind === "image" && m.imageUrl ? (
                    <div className="relative h-48 w-64 overflow-hidden rounded-xl">
                      <Image
                        src={m.imageUrl}
                        alt="image"
                        fill
                        sizes="256px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">
                      {m.body ?? ""}
                    </p>
                  )}
                  <p
                    className={`mt-1 text-[11px] ${
                      mine ? "text-white/70" : "text-gray-500"
                    }`}
                  >
                    {mine ? "User" : peer.name} · {formatDateTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
