"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { ArchiveIcon, PlusIcon, SearchIcon, UsersIcon } from "@/components/admin/icons";

export type PersonaListRow = {
  id: string;
  display_name: string;
  age: number | null;
  city: string | null;
  avatar_url: string;
  bio: string | null;
  occupation: string | null;
  status_variant: string | null;
  status_label: string | null;
  online_now: boolean | null;
  verified: boolean | null;
  is_archived: boolean | null;
  home_sort: number | null;
  joined_at: string | null;
  last_message_at: string | null;
  vibe_tags: string[] | null;
};

/** Map status-variant id → soft pill colour. */
function statusBadgeClasses(v: string | null | undefined): string {
  switch (v) {
    case "online":
    case "active":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "new":
      return "bg-orange-50 text-orange-700 ring-orange-200";
    case "popular":
      return "bg-pink-50 text-pink-700 ring-pink-200";
    case "replied":
      return "bg-violet-50 text-violet-700 ring-violet-200";
    case "quiet":
      return "bg-slate-50 text-slate-600 ring-slate-200";
    default:
      return "bg-gray-50 text-gray-600 ring-gray-200";
  }
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const min = Math.round(ms / 60000);
  if (min < 1) return "net nu";
  if (min < 60) return `${min} min`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} u`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} d`;
  const months = Math.round(days / 30);
  return `${months} mnd`;
}

export function PersonasList({ rows }: { rows: PersonaListRow[] }) {
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const inTab = rows.filter((r) => (tab === "active" ? !r.is_archived : r.is_archived));
    const q = query.trim().toLowerCase();
    if (!q) return inTab;
    return inTab.filter((r) => {
      const hay = [
        r.display_name,
        r.id,
        r.city ?? "",
        r.occupation ?? "",
        r.bio ?? "",
        ...(r.vibe_tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, tab, query]);

  const activeCount = rows.filter((r) => !r.is_archived).length;
  const archivedCount = rows.filter((r) => r.is_archived).length;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
        <div className="inline-flex rounded-xl bg-gray-100 p-0.5">
          <button
            type="button"
            onClick={() => setTab("active")}
            className={
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors " +
              (tab === "active"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800")
            }
          >
            Actief <span className="ml-1 text-gray-400">({activeCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("archived")}
            className={
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors " +
              (tab === "archived"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800")
            }
          >
            <ArchiveIcon className="-mt-0.5 mr-1 inline-block h-3.5 w-3.5" />
            Gearchiveerd <span className="ml-1 text-gray-400">({archivedCount})</span>
          </button>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zoek op naam, id, stad, beroep, vibe…"
            className="w-full rounded-xl border border-gray-200 bg-white px-9 py-2 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>
        <Link
          href="/admin/personas/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-pill transition-transform hover:scale-[1.02] hover:bg-primarySoft"
        >
          <PlusIcon className="h-4 w-4" />
          Nieuwe persona
        </Link>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          tab={tab}
          hasQuery={query.trim().length > 0}
          onClear={() => setQuery("")}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <PersonaCard key={p.id} persona={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonaCard({ persona: p }: { persona: PersonaListRow }) {
  return (
    <li>
      <Link
        href={`/admin/personas/${p.id}/edit`}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-card"
      >
        {/* Hero strip with avatar and overlayed badges */}
        <div className="relative h-32 w-full bg-gradient-to-br from-lavender to-white">
          {p.avatar_url ? (
            <Image
              src={p.avatar_url}
              alt={p.display_name}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover opacity-90 transition-transform duration-300 group-hover:scale-105"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent" />
          {/* sort badge top-left */}
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-gray-700 backdrop-blur">
            #{p.home_sort ?? 0}
          </span>
          {/* status pill top-right */}
          <span
            className={
              "absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset backdrop-blur " +
              statusBadgeClasses(p.status_variant)
            }
          >
            {p.online_now ? (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
            ) : null}
            {p.status_label ?? p.status_variant ?? "—"}
          </span>
          {/* name overlay */}
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 text-white">
            <p className="truncate font-display text-lg font-semibold tracking-tight">
              {p.display_name}
              {p.verified ? (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 align-middle text-[10px] font-bold text-white">
                  ✓
                </span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-baseline gap-1.5 text-xs text-gray-500">
            <span className="font-medium text-gray-700">{p.age ?? "?"}</span>
            <span>·</span>
            <span>{p.city ?? "—"}</span>
            {p.occupation ? (
              <>
                <span>·</span>
                <span className="truncate">{p.occupation}</span>
              </>
            ) : null}
          </div>
          <p className="line-clamp-2 text-sm leading-snug text-gray-600">
            {(p.bio ?? "").trim() || (
              <span className="italic text-gray-400">Geen bio</span>
            )}
          </p>
          {p.vibe_tags && p.vibe_tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {p.vibe_tags.slice(0, 5).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-lavender px-2 py-0.5 text-[10px] font-medium text-primary"
                >
                  {t}
                </span>
              ))}
              {p.vibe_tags.length > 5 ? (
                <span className="text-[10px] text-gray-400">+{p.vibe_tags.length - 5}</span>
              ) : null}
            </div>
          ) : null}
          <div className="mt-auto flex items-center justify-between border-t border-black/5 pt-3 text-[11px] text-gray-500">
            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
              {p.id}
            </code>
            <span>laatst {formatRelative(p.last_message_at)}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}

function EmptyState({
  tab,
  hasQuery,
  onClear,
}: {
  tab: "active" | "archived";
  hasQuery: boolean;
  onClear: () => void;
}) {
  if (hasQuery) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
        <SearchIcon className="mb-3 h-8 w-8 text-gray-300" />
        <p className="text-sm font-medium text-gray-700">Geen resultaten</p>
        <p className="mt-1 max-w-md text-xs text-gray-500">
          Probeer een andere zoekterm, of schakel naar het andere tabblad.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="mt-4 rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-500"
        >
          Zoekfilter wissen
        </button>
      </div>
    );
  }
  if (tab === "archived") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
        <ArchiveIcon className="mb-3 h-8 w-8 text-gray-300" />
        <p className="text-sm font-medium text-gray-700">Geen gearchiveerde personas</p>
        <p className="mt-1 max-w-md text-xs text-gray-500">
          Wanneer je een persona archiveert, verschijnt ze hier — ze blijft bewaard maar
          verdwijnt uit discovery en home.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
      <UsersIcon className="mb-3 h-10 w-10 text-gray-300" />
      <p className="text-base font-semibold text-gray-800">Nog geen personas</p>
      <p className="mt-1 max-w-md text-sm text-gray-500">
        Maak je eerste persona aan — geef haar een eigen identiteit, look en backstory zodat
        de AI haar als een echt persoon kan laten chatten.
      </p>
      <Link
        href="/admin/personas/new"
        className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-pill hover:bg-primarySoft"
      >
        <PlusIcon className="h-4 w-4" />
        Nieuwe persona aanmaken
      </Link>
    </div>
  );
}
