"use client";

import Image from "next/image";
import { useState } from "react";
import { CheckIcon, XIcon } from "@/components/admin/icons";

type Props = {
  personaId: string;
  mode: "create" | "edit";
  avatarUrl: string;
  galleryUrls: string[];
  onAvatarChange: (url: string) => void;
  onGalleryChange: (urls: string[]) => void;
};

export function PersonaGalleryGrid({
  personaId,
  mode,
  avatarUrl,
  galleryUrls,
  onAvatarChange,
  onGalleryChange,
}: Props) {
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function persistRemove(url: string): Promise<string[] | null> {
    if (mode !== "edit" || !personaId) return null;
    const res = await fetch(
      `/api/admin/personas/${encodeURIComponent(personaId)}/remove-gallery-photo`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      },
    );
    const data = (await res.json()) as {
      ok?: boolean;
      gallery_urls?: string[];
      error?: string;
    };
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? `Verwijderen mislukt (${res.status})`);
    }
    return Array.isArray(data.gallery_urls) ? data.gallery_urls : null;
  }

  async function persistAvatar(url: string): Promise<void> {
    if (mode !== "edit" || !personaId) return;
    const res = await fetch(
      `/api/admin/personas/${encodeURIComponent(personaId)}/set-avatar`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      },
    );
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? `Avatar instellen mislukt (${res.status})`);
    }
  }

  async function handleRemove(url: string) {
    if (!url) return;
    if (!confirm("Deze foto uit de galerij verwijderen?")) return;
    setErr(null);
    setBusyUrl(url);
    try {
      const next =
        mode === "edit"
          ? await persistRemove(url)
          : galleryUrls.filter((u) => u !== url);
      const gallery = next ?? galleryUrls.filter((u) => u !== url);
      onGalleryChange(gallery);
      if (avatarUrl === url) {
        if (mode === "edit") {
          await persistAvatar("");
        }
        onAvatarChange("");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyUrl(null);
    }
  }

  async function handleSetAvatar(url: string) {
    if (!url || url === avatarUrl) return;
    setErr(null);
    setBusyUrl(url);
    try {
      if (mode === "edit") {
        await persistAvatar(url);
      }
      onAvatarChange(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyUrl(null);
    }
  }

  if (galleryUrls.length === 0) {
    return (
      <p className="text-xs text-gray-400">
        Nog geen foto&apos;s in de galerij. Upload of genereer hieronder.
      </p>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {galleryUrls.map((url, i) => {
          const isAvatar = Boolean(url && avatarUrl && url === avatarUrl);
          const busy = busyUrl === url;
          return (
            <div
              key={`${url}-${i}`}
              className={
                "group relative aspect-[3/4] overflow-hidden rounded-xl bg-gray-100 ring-2 transition-shadow " +
                (isAvatar ? "ring-primary shadow-md" : "ring-black/5")
              }
            >
              {url ? (
                <Image src={url} alt="" fill sizes="200px" className="object-cover" />
              ) : null}

              {isAvatar ? (
                <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                  <CheckIcon className="h-3 w-3" />
                  Profiel
                </span>
              ) : null}

              <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 bg-gradient-to-t from-black/75 via-black/40 to-transparent p-2 pt-8 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                {!isAvatar ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSetAvatar(url)}
                    className="w-full rounded-lg bg-white/95 px-2 py-1.5 text-[11px] font-semibold text-gray-900 transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {busy ? "…" : "Als profielfoto"}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRemove(url)}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-black/55 px-2 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-50"
                >
                  <XIcon className="h-3 w-3" />
                  Verwijderen
                </button>
              </div>

              {busy ? (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/25">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {err ? <p className="mt-2 text-[11px] text-rose-600">{err}</p> : null}
      {mode === "edit" ? (
        <p className="mt-2 text-[10px] text-gray-500">
          Wijzigingen aan galerij en profielfoto worden direct opgeslagen.
        </p>
      ) : null}
    </div>
  );
}

