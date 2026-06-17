"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPageHeader } from "@/components/admin/page-header";
import type { ProfileAssetVariant } from "@/lib/admin/profile-assets";

type Profile = {
  id: string;
  display_name: string;
  avatar_url: string;
  age: number | null;
  city: string | null;
  online_now: boolean;
  is_archived: boolean;
  liveAssetUrl?: string | null;
};

export default function ProfileAssetsAdminPage() {
  const [variant, setVariant] = useState<ProfileAssetVariant>("v2");
  const [liveProfiles, setLiveProfiles] = useState<Profile[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [liveMapFolderPath, setLiveMapFolderPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const showMessage = useCallback((text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 3500);
  }, []);

  const load = useCallback(
    async (v: ProfileAssetVariant) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/profile-assets?variant=${v}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setLiveProfiles(Array.isArray(data.liveProfiles) ? data.liveProfiles : []);
        setAllProfiles(Array.isArray(data.allProfiles) ? data.allProfiles : []);
        setLiveMapFolderPath(
          typeof data.liveMapFolderPath === "string" ? data.liveMapFolderPath : "",
        );
      } catch (e) {
        showMessage(e instanceof Error ? e.message : "Laden mislukt");
        setLiveProfiles([]);
        setAllProfiles([]);
      } finally {
        setLoading(false);
      }
    },
    [showMessage],
  );

  useEffect(() => {
    void load(variant);
  }, [variant, load]);

  const availableProfiles = useMemo(
    () => allProfiles.filter((p) => !p.online_now && p.avatar_url),
    [allProfiles],
  );

  async function addToLive(personaId: string) {
    setBusyId(personaId);
    try {
      const res = await fetch("/api/admin/profile-assets/publish-live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publish", variant, personaId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Mislukt");
      await load(variant);
      showMessage("Profiel toegevoegd aan live map.");
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "Mislukt");
    } finally {
      setBusyId(null);
    }
  }

  async function removeFromLive(personaId: string) {
    setBusyId(personaId);
    try {
      const res = await fetch("/api/admin/profile-assets/publish-live", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "unpublish", variant, personaId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Mislukt");
      await load(variant);
      showMessage("Profiel uit live map gehaald.");
    } catch (e) {
      showMessage(e instanceof Error ? e.message : "Mislukt");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-8">
        <AdminPageHeader
          crumbs={[
            { href: "/admin/personas", label: "Personas" },
            { label: "Live profielen" },
          ]}
          title="Live profielen"
          description={
            <>
              Klik een profiel om het in de live map te zetten. Map:{" "}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                {liveMapFolderPath || `live-profiles/${variant}`}
              </code>
            </>
          }
          actions={
            <div className="flex rounded-full border border-gray-200 bg-gray-50 p-1 text-sm">
              {(["v1", "v2"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVariant(v)}
                  className={`rounded-full px-4 py-1.5 font-semibold transition ${
                    variant === v
                      ? "bg-gray-900 text-white"
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
          }
        />

        {message && (
          <div className="mb-4 rounded-xl bg-gray-900 px-4 py-3 text-sm text-white">{message}</div>
        )}

        {/* Live map */}
        <section className="mb-10">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-emerald-700">
            Live map · {liveProfiles.length} profiel{liveProfiles.length === 1 ? "" : "en"}
          </h2>
          {loading ? (
            <p className="py-12 text-center text-sm text-gray-400">Laden…</p>
          ) : liveProfiles.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
              Nog geen live profielen. Klik hieronder een profiel om toe te voegen.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {liveProfiles.map((p) => (
                <div key={p.id} className="overflow-hidden rounded-xl border border-emerald-200">
                  <div className="relative aspect-[3/4] bg-gray-100">
                    <Image
                      src={p.liveAssetUrl || p.avatar_url}
                      alt={p.display_name}
                      fill
                      className="object-cover"
                      sizes="120px"
                      unoptimized
                    />
                  </div>
                  <div className="p-2">
                    <div className="truncate text-xs font-semibold">{p.display_name}</div>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={() => void removeFromLive(p.id)}
                      className="mt-1 w-full rounded-lg bg-gray-100 py-1 text-[11px] font-medium hover:bg-gray-200 disabled:opacity-40"
                    >
                      {busyId === p.id ? "…" : "Verwijder"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Select profiles */}
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">
            Profielen toevoegen · klik om live te zetten
          </h2>
          {loading ? (
            <p className="py-12 text-center text-sm text-gray-400">Laden…</p>
          ) : availableProfiles.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">
              Alle profielen staan al live, of hebben geen foto.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {availableProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => void addToLive(p.id)}
                  className="overflow-hidden rounded-xl border border-gray-200 text-left transition hover:border-emerald-400 hover:ring-2 hover:ring-emerald-100 disabled:opacity-40"
                >
                  <div className="relative aspect-[3/4] bg-gray-100">
                    <Image
                      src={p.avatar_url}
                      alt={p.display_name}
                      fill
                      className="object-cover"
                      sizes="120px"
                      unoptimized
                    />
                    {p.is_archived && (
                      <span className="absolute left-1.5 top-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        ARCHIEF
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <div className="truncate text-xs font-semibold">{p.display_name}</div>
                    <div className="truncate text-[10px] text-gray-400">
                      {p.age ?? "—"} · {p.city ?? "—"}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <p className="mt-8 text-center text-xs text-gray-400">
          Profiel bewerken via{" "}
          <Link href="/admin/personas" className="underline">
            Personas
          </Link>
        </p>
      </div>
    </div>
  );
}
