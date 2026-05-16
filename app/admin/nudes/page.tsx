"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AdminPageHeader } from "@/components/admin/page-header";
// Nude generation now uses the dedicated nude template pool in lib/images/nude-scene-templates.ts

type Persona = {
  id: string;
  display_name: string;
  age: number | null;
  city: string | null;
  avatar_url: string | null;
  gallery_urls: string[];
};

export default function NudesAdminPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const [modalPersona, setModalPersona] = useState<Persona | null>(null);
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null);

  async function loadPersonas() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/personas?only_ai=true", { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      const rows: Persona[] = (json.personas ?? []).map((r: any) => ({
        id: r.id,
        display_name: r.display_name,
        age: r.age,
        city: r.city,
        avatar_url: r.avatar_url,
        gallery_urls: Array.isArray(r.gallery_urls) ? r.gallery_urls : [],
      }));
      setPersonas(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kon personen niet laden");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPersonas();
  }, []);

  async function generateNudes(personaId: string) {
    setGeneratingId(personaId);
    setProgress({ done: 0, total: 3 });
    setError(null);

    let success = 0;
    let lastErr: string | null = null;

    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch(`/api/admin/personas/${encodeURIComponent(personaId)}/append-gallery-photo`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nude: true,
            variant: 15000 + i * 1337,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) {
          lastErr = data.error ?? `HTTP ${res.status}`;
          continue;
        }
        success++;
        setProgress({ done: success, total: 3 });

        // Update local state immediately
        setPersonas((prev) =>
          prev.map((p) =>
            p.id === personaId
              ? {
                  ...p,
                  gallery_urls: Array.isArray(data.gallery_urls)
                    ? data.gallery_urls
                    : [...p.gallery_urls, data.gallery_url],
                }
              : p,
          ),
        );
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }

    if (success < 3 && lastErr) {
      setError(`${success}/3 gelukt — ${lastErr}`);
    }

    setGeneratingId(null);
    setProgress(null);

    // Auto-open modal so user immediately sees the new nude photos
    const updatedPersona = personas.find((pp) => pp.id === personaId);
    if (updatedPersona) {
      setModalPersona(updatedPersona);
    }
  }

  async function removePhoto(personaId: string, url: string) {
    setDeletingUrl(url);
    try {
      const res = await fetch(`/api/admin/personas/${encodeURIComponent(personaId)}/remove-gallery-photo`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        alert(data.error ?? "Verwijderen mislukt");
        return;
      }

      // Update local state
      setPersonas((prev) =>
        prev.map((p) =>
          p.id === personaId ? { ...p, gallery_urls: data.gallery_urls ?? p.gallery_urls.filter((u) => u !== url) } : p,
        ),
      );

      // If modal is open for this persona, update it too
      if (modalPersona?.id === personaId) {
        setModalPersona((prev) =>
          prev ? { ...prev, gallery_urls: data.gallery_urls ?? prev.gallery_urls.filter((u) => u !== url) } : null,
        );
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Netwerkfout");
    } finally {
      setDeletingUrl(null);
    }
  }

  function openModal(p: Persona) {
    setModalPersona(p);
  }

  function closeModal() {
    setModalPersona(null);
  }

  const totalNudes = personas.reduce((sum, p) => sum + p.gallery_urls.length, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <AdminPageHeader
        title="Naaktfoto's beheren"
        description="Genereer en beheer expliciete foto's per persona — supersimpel"
      />

      <div className="mx-auto max-w-7xl px-6 pb-16 pt-8">
        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-950/60 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-white/60">
              {personas.length} persona's • {totalNudes} foto's in totaal
            </p>
          </div>
          <button
            onClick={() => void loadPersonas()}
            className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/5"
          >
            Vernieuwen
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-white/60">Laden…</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {personas.map((p) => {
              const isGenerating = generatingId === p.id;
              const nudeCount = p.gallery_urls.length;

              return (
                <div
                  key={p.id}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/60 shadow-xl"
                >
                  <div className="relative aspect-[4/3] bg-zinc-900">
                    {p.avatar_url ? (
                      <Image
                        src={p.avatar_url}
                        alt={p.display_name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-6xl text-white/30">👤</div>
                    )}
                    <div className="absolute bottom-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium backdrop-blur">
                      {nudeCount} foto{nudeCount === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="flex items-baseline gap-2">
                      <div className="text-xl font-semibold tracking-tight">{p.display_name}</div>
                      {p.age && <div className="text-sm text-white/50">{p.age}</div>}
                    </div>
                    {p.city && <div className="text-sm text-white/50">{p.city}</div>}

                    {/* Small nude preview strip so user can immediately see generated photos */}
                    {p.gallery_urls.length > 0 && (
                      <div className="mt-3 flex gap-1.5 overflow-hidden">
                        {p.gallery_urls.slice(-3).map((url, idx) => (
                          <div
                            key={idx}
                            className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10"
                            onClick={() => openModal(p)}
                          >
                            <Image
                              src={url}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="56px"
                            />
                          </div>
                        ))}
                        {p.gallery_urls.length > 3 && (
                          <div
                            className="flex h-14 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-[11px] text-white/70 ring-1 ring-white/10"
                            onClick={() => openModal(p)}
                          >
                            +{p.gallery_urls.length - 3}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        onClick={() => void generateNudes(p.id)}
                        disabled={isGenerating || !!generatingId}
                        className="flex h-12 w-full items-center justify-center rounded-2xl bg-rose-600 text-sm font-semibold transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-900"
                      >
                        {isGenerating
                          ? `Bezig… ${progress?.done ?? 0}/3`
                          : "Genereer 3 naaktfoto's"}
                      </button>

                      <button
                        onClick={() => openModal(p)}
                        className="flex h-12 w-full items-center justify-center rounded-2xl border border-white/20 text-sm font-medium transition hover:bg-white/5"
                      >
                        Bekijk & verwijder foto's
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Manage photos for one persona */}
      {modalPersona && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 p-4" onClick={closeModal}>
          <div
            className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <div className="text-xl font-semibold">{modalPersona.display_name}</div>
                <div className="text-sm text-white/50">
                  {modalPersona.gallery_urls.length} foto{modalPersona.gallery_urls.length === 1 ? "" : "s"}
                </div>
              </div>
              <button
                onClick={closeModal}
                className="rounded-full border border-white/20 px-4 py-1.5 text-sm hover:bg-white/5"
              >
                Sluiten
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-6">
              {modalPersona.gallery_urls.length === 0 ? (
                <div className="py-16 text-center text-white/50">Geen foto's nog.</div>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                  {modalPersona.gallery_urls.map((url, idx) => (
                    <div key={`${url}-${idx}`} className="group relative overflow-hidden rounded-2xl bg-zinc-900">
                      <div className="relative aspect-[3/4]">
                        <Image
                          src={url}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 1024px) 50vw, 25vw"
                        />
                      </div>
                      <button
                        onClick={() => void removePhoto(modalPersona.id, url)}
                        disabled={deletingUrl === url}
                        className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white opacity-90 transition hover:bg-red-700 disabled:opacity-50"
                      >
                        {deletingUrl === url ? "..." : "×"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
              <button
                onClick={() => {
                  if (confirm("Weet je zeker dat je alle foto's van deze persona wilt verwijderen?")) {
                    modalPersona.gallery_urls.forEach((u) => void removePhoto(modalPersona.id, u));
                  }
                }}
                className="rounded-xl border border-red-500/50 px-5 py-2 text-sm text-red-400 hover:bg-red-950"
              >
                Alles verwijderen
              </button>
              <button
                onClick={closeModal}
                className="rounded-xl bg-white px-6 py-2 text-sm font-semibold text-black"
              >
                Klaar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
