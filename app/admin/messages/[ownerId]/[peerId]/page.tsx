import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  messageRowToUi,
  type ChatMessageRow,
  type ChatProfileRow,
} from "@/lib/chat/map-rows";

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

  const [{ data: msgs, error: me }, { data: prof }, { data: userData }] =
    await Promise.all([
      service
        .from("chat_messages")
        .select("*")
        .eq("owner_user_id", ownerId)
        .eq("peer_id", peerId)
        .order("created_at", { ascending: true }),
      service
        .from("chat_profiles")
        .select("id, display_name, avatar_url")
        .eq("id", peerId)
        .maybeSingle(),
      service.auth.admin.getUserById(ownerId),
    ]);

  if (me) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        Fout bij laden: {me.message}
      </div>
    );
  }

  const profile = prof as Pick<
    ChatProfileRow,
    "id" | "display_name" | "avatar_url"
  > | null;
  const ownerEmail = userData?.user?.email ?? null;
  const messages = ((msgs ?? []) as ChatMessageRow[]).map(messageRowToUi);

  const peerName = profile?.display_name ?? peerId;
  const peerAvatar = profile?.avatar_url ?? "";

  return (
    <div>
      <Link
        href="/admin/messages"
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        ← Alle berichten
      </Link>

      <div className="mt-4 flex items-center gap-4 rounded-2xl border border-black/5 bg-white p-5">
        <div className="relative h-14 w-14 overflow-hidden rounded-full bg-gray-100">
          {peerAvatar ? (
            <Image
              src={peerAvatar}
              alt={peerName}
              fill
              sizes="56px"
              className="object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-semibold tracking-tight">{peerName}</p>
          <p className="mt-0.5 text-sm text-gray-600">
            Gebruiker:{" "}
            <span className="font-medium text-gray-900">
              {ownerEmail ?? ownerId}
            </span>
          </p>
        </div>
        <span className="ml-auto rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {messages.length} berichten
        </span>
      </div>

      <div className="mt-6 space-y-3">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600">
            Geen berichten in dit gesprek.
          </div>
        ) : (
          messages.map((m, i) => {
            const row = (msgs ?? [])[i] as ChatMessageRow;
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
                      : "bg-white text-gray-900 border border-black/5"
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
                    {mine ? "User" : peerName} ·{" "}
                    {formatDateTime(row.created_at)}
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
