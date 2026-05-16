"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  MoreIcon,
  PencilIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/admin/icons";

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

type ToastKind = "ok" | "err";
type Toast = { kind: ToastKind; text: string };

export function PersonasList({ rows }: { rows: PersonaListRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [query, setQuery] = useState("");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

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

  // Reset selection on tab change.
  useEffect(() => {
    setSelected(new Set());
  }, [tab]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllVisible() {
    setSelected(new Set(filtered.map((r) => r.id)));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  async function singleAction(id: string, mode: "archive" | "restore" | "hard") {
    if (mode === "hard") {
      if (
        !confirm(
          `Definitief verwijderen?\n\nDit verwijdert deze persona PERMANENT, samen met alle berichten, foto's en chatgeschiedenis. Niet ongedaan te maken.`,
        )
      ) {
        return;
      }
    }
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(
        `/api/admin/personas/${encodeURIComponent(id)}?mode=${mode}`,
        { method: "DELETE" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Fout (${res.status})`);
      setToast({
        kind: "ok",
        text:
          mode === "hard"
            ? "Persona definitief verwijderd."
            : mode === "archive"
              ? "Persona gearchiveerd."
              : "Persona hersteld.",
      });
      router.refresh();
    } catch (e) {
      setToast({
        kind: "err",
        text: e instanceof Error ? e.message : "Onbekende fout.",
      });
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function bulkAction(mode: "archive" | "restore" | "hard") {
    if (selected.size === 0) return;
    if (mode === "hard") {
      if (
        !confirm(
          `${selected.size} personas DEFINITIEF verwijderen?\n\nAlle berichten, foto's en chatgeschiedenis van deze personas worden permanent gewist. Niet ongedaan te maken.`,
        )
      ) {
        return;
      }
    }
    setBulkBusy(true);
    try {
      const res = await fetch(`/api/admin/personas/bulk-delete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), mode }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Fout (${res.status})`);
      setToast({
        kind: "ok",
        text:
          mode === "hard"
            ? `${json.affected ?? selected.size} personas verwijderd.`
            : mode === "archive"
              ? `${json.affected ?? selected.size} personas gearchiveerd.`
              : `${json.affected ?? selected.size} personas hersteld.`,
      });
      clearSelection();
      setSelectMode(false);
      router.refresh();
    } catch (e) {
      setToast({
        kind: "err",
        text: e instanceof Error ? e.message : "Onbekende fout.",
      });
    } finally {
      setBulkBusy(false);
    }
  }

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
        <button
          type="button"
          onClick={() => {
            setSelectMode((v) => !v);
            if (selectMode) clearSelection();
          }}
          className={
            "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors " +
            (selectMode
              ? "border border-primary bg-primary/10 text-primary"
              : "border border-gray-200 bg-white text-gray-700 hover:border-gray-400")
          }
        >
          <CheckIcon className="h-4 w-4" />
          {selectMode ? "Selecteren stoppen" : "Meerdere selecteren"}
        </button>
        <Link
          href="/admin/personas/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-pill transition-transform hover:scale-[1.02] hover:bg-primarySoft"
        >
          <PlusIcon className="h-4 w-4" />
          Nieuwe persona
        </Link>
      </div>

      {/* Bulk action bar — sticky just under the toolbar when items selected */}
      {selectMode && selected.size > 0 ? (
        <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 shadow-sm backdrop-blur">
          <span className="text-sm font-semibold text-primary">
            {selected.size} geselecteerd
          </span>
          <button
            type="button"
            onClick={selectAllVisible}
            disabled={bulkBusy || filtered.length === 0}
            className="rounded-lg border border-primary/30 bg-white px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            Alles op deze tab ({filtered.length})
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={bulkBusy}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-gray-400 disabled:opacity-50"
          >
            Wissen
          </button>
          <span className="ml-auto" />
          {tab === "active" ? (
            <button
              type="button"
              onClick={() => bulkAction("archive")}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
            >
              <ArchiveIcon className="h-4 w-4" />
              Archiveer
            </button>
          ) : (
            <button
              type="button"
              onClick={() => bulkAction("restore")}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              <RefreshIcon className="h-4 w-4" />
              Herstel
            </button>
          )}
          <button
            type="button"
            onClick={() => bulkAction("hard")}
            disabled={bulkBusy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
            {bulkBusy ? "Bezig…" : "Definitief verwijderen"}
          </button>
        </div>
      ) : null}

      {/* Toast */}
      {toast ? (
        <div
          className={
            "rounded-xl px-4 py-2 text-sm shadow-sm " +
            (toast.kind === "ok"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-800")
          }
        >
          {toast.text}
        </div>
      ) : null}

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          tab={tab}
          hasQuery={query.trim().length > 0}
          onClear={() => setQuery("")}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {filtered.map((p) => (
            <PersonaCard
              key={p.id}
              persona={p}
              selectMode={selectMode}
              selected={selected.has(p.id)}
              onToggleSelect={() => toggleSelect(p.id)}
              busy={busyIds.has(p.id)}
              onAction={(mode) => singleAction(p.id, mode)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PersonaCard({
  persona: p,
  selectMode,
  selected,
  onToggleSelect,
  busy,
  onAction,
}: {
  persona: PersonaListRow;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  busy: boolean;
  onAction: (mode: "archive" | "restore" | "hard") => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const cardClasses =
    "group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all " +
    (selected
      ? "border-primary ring-2 ring-primary/30"
      : "border-black/5 hover:-translate-y-0.5 hover:shadow-card");

  const inner = (
    <>
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
    </>
  );

  return (
    <li className="relative">
      {selectMode ? (
        <button
          type="button"
          onClick={onToggleSelect}
          className={cardClasses + " w-full text-left"}
        >
          {inner}
        </button>
      ) : (
        <Link href={`/admin/personas/${p.id}/edit`} className={cardClasses}>
          {inner}
        </Link>
      )}

      {/* Selection checkbox — visible when select mode OR when hovering. */}
      {selectMode ? (
        <span
          className={
            "pointer-events-none absolute left-3 top-3 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors " +
            (selected
              ? "border-primary bg-primary text-white"
              : "border-white/80 bg-white/30 backdrop-blur")
          }
        >
          {selected ? <CheckIcon className="h-4 w-4" /> : null}
        </span>
      ) : null}

      {/* 3-dots action menu — top-right, sits above the status pill */}
      {!selectMode ? (
        <div ref={menuRef} className="absolute right-2 top-2 z-10">
          <button
            type="button"
            aria-label="Acties"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow-sm ring-1 ring-black/5 backdrop-blur transition-colors hover:bg-white disabled:opacity-50"
          >
            {busy ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
            ) : (
              <MoreIcon className="h-4 w-4" />
            )}
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-9 w-52 overflow-hidden rounded-xl border border-black/5 bg-white shadow-lg ring-1 ring-black/5">
              <Link
                href={`/admin/personas/${p.id}/edit`}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                onClick={() => setMenuOpen(false)}
              >
                <PencilIcon className="h-4 w-4 text-gray-500" />
                Bewerken
              </Link>
              {p.is_archived ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(false);
                    onAction("restore");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50"
                >
                  <RefreshIcon className="h-4 w-4" />
                  Herstel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(false);
                    onAction("archive");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-amber-700 hover:bg-amber-50"
                >
                  <ArchiveIcon className="h-4 w-4" />
                  Archiveer
                </button>
              )}
              <div className="my-0.5 h-px bg-gray-100" />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false);
                  onAction("hard");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50"
              >
                <TrashIcon className="h-4 w-4" />
                Definitief verwijderen
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
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
