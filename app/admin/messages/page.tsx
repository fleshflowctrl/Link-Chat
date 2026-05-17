import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  loadAdminChatUsers,
  type AdminChatUserSummary,
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

  const service = getServiceSupabase();
  if (!service) {
    return (
      <div className="mx-auto max-w-7xl">
        <AdminPageHeader
          crumbs={[{ label: "Admin" }, { label: "Berichten" }]}
          title="Berichten"
          description="Alle gesprekken per gebruiker."
        />
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          SUPABASE_SERVICE_ROLE_KEY ontbreekt — voeg hem toe aan je env.
        </div>
      </div>
    );
  }

  let users: AdminChatUserSummary[] = [];
  let loadError: string | null = null;
  try {
    users = await loadAdminChatUsers(service);
  } catch (e) {
    users = [];
    loadError = e instanceof Error ? e.message : "Laden mislukt";
  }

  const totalMessages = users.reduce((n, u) => n + u.messageCount, 0);

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        crumbs={[{ label: "Admin" }, { label: "Berichten" }]}
        title="Berichten"
        description={
          <>
            Kies een gebruiker om hun gesprekken te bekijken en mee te lezen.
            {users.length > 0 ? (
              <span className="ml-1 text-gray-500">
                ({users.length} gebruiker{users.length === 1 ? "" : "s"},{" "}
                {totalMessages} berichten verstuurd)
              </span>
            ) : null}
          </>
        }
      />

      {loadError ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {loadError}
        </div>
      ) : null}

      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <ChatBubbleIcon className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">Nog geen berichten</p>
          <p className="mt-1 max-w-md text-xs text-gray-500">
            Zodra een gebruiker chat met een persona verschijnt die hier.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          {users.map((u) => (
            <li key={u.ownerUserId}>
              <Link
                href={`/admin/messages/${u.ownerUserId}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-1 ring-primary/20">
                  {(u.ownerEmail?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {u.ownerEmail ?? (
                        <span className="font-mono text-gray-600">
                          {u.ownerUserId.slice(0, 8)}…
                        </span>
                      )}
                    </p>
                    <span className="shrink-0 text-xs text-gray-500">
                      {formatDateTime(u.lastMessageAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-gray-600">
                    {u.threadCount} gesprek{u.threadCount === 1 ? "" : "ken"} ·{" "}
                    laatste: {u.lastMessagePreview}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                  title="Berichten verstuurd door deze gebruiker"
                >
                  {u.messageCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
