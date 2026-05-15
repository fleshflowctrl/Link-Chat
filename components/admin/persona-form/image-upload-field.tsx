"use client";

import Image from "next/image";
import { useState, type ChangeEvent } from "react";
import { CameraIcon, UploadIcon, XIcon } from "@/components/admin/icons";
import { TextInput } from "./primitives";

/** Avatar/gallery slot — preview tile + URL input + upload-from-disk action.
 * Uploads go through /api/admin/personas/upload which writes via the
 * service-role client, so the admin doesn't need bucket-RLS write access. */
export function ImageUploadField({
  personaId,
  slot,
  url,
  onChange,
  variant = "row",
}: {
  personaId: string;
  slot: "avatar" | "gallery";
  url: string;
  onChange: (url: string) => void;
  /** "tile" — large square preview (avatar). "row" — small preview + URL. */
  variant?: "row" | "tile";
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!personaId.trim()) {
      setErr("Vul eerst een persona-ID in.");
      e.target.value = "";
      return;
    }
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("persona_id", personaId);
    fd.append("slot", slot);
    try {
      const res = await fetch("/api/admin/personas/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Upload faalde");
      }
      onChange(json.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  if (variant === "tile") {
    return (
      <div className="flex flex-col gap-3">
        <div className="relative aspect-square w-full max-w-[220px] overflow-hidden rounded-2xl bg-gradient-to-br from-lavender to-white ring-1 ring-black/5">
          {url ? (
            <>
              <Image src={url} alt="avatar preview" fill sizes="220px" className="object-cover" />
              <button
                type="button"
                onClick={() => onChange("")}
                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
                aria-label="verwijder avatar"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-gray-400">
              <CameraIcon className="h-7 w-7" />
              <span className="mt-1 text-[11px]">geen avatar</span>
            </div>
          )}
        </div>
        <div className="flex w-full max-w-[220px] flex-col gap-2">
          <TextInput
            type="url"
            value={url}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            placeholder="https://… of upload"
          />
          <label className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary">
            <UploadIcon className="h-4 w-4" />
            {busy ? "Uploaden…" : "Upload bestand"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={handleFile}
              className="hidden"
            />
          </label>
          {err ? <p className="text-xs text-rose-600">{err}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {url ? (
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5">
            <Image src={url} alt="" fill sizes="56px" className="object-cover" />
          </div>
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-400">
            <CameraIcon className="h-5 w-5" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 min-w-0">
          <TextInput
            type="url"
            value={url}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            placeholder="https://… (plak URL of upload bestand)"
          />
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary">
              <UploadIcon className="h-3.5 w-3.5" />
              {busy ? "Uploaden…" : "Upload bestand"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={handleFile}
                className="hidden"
              />
            </label>
            {url ? (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-[11px] text-gray-500 hover:text-rose-600"
              >
                wissen
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {err ? <p className="text-xs text-rose-600">{err}</p> : null}
    </div>
  );
}
