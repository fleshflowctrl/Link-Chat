import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import type { AdminThreadSummary } from "@/app/api/admin/threads/route";

export const dynamic = "force-dynamic";

type MessageRow = {
  owner_user_id: string;
  peer_id: string;
  body: string | null;
  kind: string;
  reaction_emoji: string | null;
  sender: string;
  created_at: string;
};

type ProfileRow = { id: string; display_name: string; avatar_url: string };
type AuthUserRow = { id: string; email: string | null };

type LoadResult = {
  threads: AdminThreadSummary[];
  diagnostics: {
    serviceConfigured: boolean;
    rawMessageCount: number;
    error?: string;
  };
};

async function loadThreads(): Promise<LoadResult> {
  const service = getServiceSupabase();
  if (!service) {
    return {
      threads: [],
      diagnostics: {
        serviceConfigured: false,
        rawMessageCount: 0,
        error:
          "SUPABASE_SERVICE_ROLE_KEY ontbreekt — voeg hem toe aan je .env / Vercel env vars.",
      },
    };
  }

  const { data: msgs, error: msgsError } = await service
    .from("chat_messages")
    .select(
      "owner_user_id, peer_id, body, kind, reaction_emoji, sender, created_at",
    )
    .order("created_at", { ascending: false });

  if (msgsError) {
    console.error("[admin/messages] chat_messages select", msgsError);
    return {
      threads: [],
      diagnostics: {
        serviceConfigured: true,
        rawMessageCount: 0,
        error: `chat_messages select faalde: ${msgsError.message}`,
      },
    };
  }

  const rows = (msgs ?? []) as MessageRow[];
  const counts = new Map<string, number>();
  const latest = new Map<string, MessageRow>();
  for (const m of rows) {
    const key = `${m.owner_user_id}::${m.peer_id}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!latest.has(key)) latest.set(key, m);
  }

  const peerIds = Array.from(new Set(rows.map((m) => m.peer_id)));
  const ownerIds = Array.from(new Set(rows.map((m) => m.owner_user_id)));

  const peerById = new Map<string, ProfileRow>();
  if (peerIds.length > 0) {
    const { data: profs } = await service
      .from("chat_profiles")
      .select("id, display_name, avatar_url")
      .in("id", peerIds);
    for (const p of (profs ?? []) as ProfileRow[]) peerById.set(p.id, p);
  }

  const emailById = new Map<string, string | null>();
  if (ownerIds.length > 0) {
    let page = 1;
    const perPage = 200;
    while (page <= 10) {
      const { data, error } = await service.auth.admin.listUsers({
        page,
        perPage,
      });
      if (error) break;
      const users = (data?.users ?? []) as AuthUserRow[];
      for (const u of users) emailById.set(u.id, u.email ?? null);
      if (users.length < perPage) break;
      page += 1;
    }
  }

  const threads = Array.from(latest.entries())
    .map(([key, m]) => {
      const profile = peerById.get(m.peer_id);
      const preview =
        m.kind === "image"
          ? "Foto"
          : m.reaction_emoji
            ? "Reactie"
            : (m.body ?? "").trim() || "Bericht";
      return {
        ownerUserId: m.owner_user_id,
        ownerEmail: emailById.get(m.owner_user_id) ?? null,
        peerId: m.peer_id,
        peerName: profile?.display_name ?? m.peer_id,
        peerAvatarUrl: profile?.avatar_url ?? "",
        messageCount: counts.get(key) ?? 1,
        lastMessageAt: m.created_at,
        lastMessagePreview: preview,
        lastSender: (m.sender === "me" ? "me" : "peer") as "me" | "peer",
      } satisfies AdminThreadSummary;
    })
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );

  return {
    threads,
    diagnostics: {
      serviceConfigured: true,
      rawMessageCount: rows.length,
    },
  };
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("nl-NL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function AdminMessagesPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) {
      redirect("/login?next=/admin/messages");
    }
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-lg font-semibold">Geen toegang</h1>
        <p className="mt-1 text-sm">{auth.error}</p>
        <p className="mt-3 text-xs text-red-800/80">
          Tip: zet <code>is_admin = true</code> op je{" "}
          <code>user_profiles</code>-rij om dit dashboard te kunnen openen.
        </p>
      </div>
    );
  }

  const { threads, diagnostics } = await loadThreads();

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Berichten</h1>
          <p className="mt-1 text-sm text-gray-600">
            Alle gesprekken van alle gebruikers, met de meest recente bovenaan.
            {diagnostics.serviceConfigured ? (
              <span className="ml-1 text-gray-500">
                ({diagnostics.rawMessageCount} berichten in totaal)
              </span>
            ) : null}
          </p>
        </div>
        <span className="text-xs text-gray-500">
          Ingelogd als {auth.email ?? auth.userId}
        </span>
      </div>

      {diagnostics.error && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {diagnostics.error}
        </div>
      )}

      {threads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600">
          Er zijn nog geen berichten. Zodra een gebruiker chat verschijnt het
          hier.
        </div>
      ) : (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/5 bg-white">
          {threads.map((t) => (
            <li key={`${t.ownerUserId}-${t.peerId}`}>
              <Link
                href={`/admin/messages/${t.ownerUserId}/${t.peerId}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50"
              >
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-100">
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
                      <span className="ml-2 font-normal text-gray-500">
                        ↔ {t.ownerEmail ?? t.ownerUserId.slice(0, 8)}
                      </span>
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
                <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
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
