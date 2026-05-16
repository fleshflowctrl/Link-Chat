"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Image from "next/image";

import {
  CameraIcon,
  CheckIcon,
  RefreshIcon,
  SparkleIcon,
  TrashIcon,
  XIcon,
} from "@/components/admin/icons";

const TEST_PRESETS: Array<{ id: string; label: string }> = [
  { id: "young-slim-striking", label: "24j · slank · striking" },
  { id: "young-average", label: "26j · gemiddeld · average" },
  { id: "young-plus-average", label: "27j · plus · average" },
  { id: "mid-average", label: "38j · gemiddeld · average" },
  { id: "mid-plus-average", label: "42j · plus · average" },
  { id: "senior-average", label: "58j · gemiddeld · average" },
  { id: "senior-plus", label: "65j · plus · average" },
];

type Kind = "avatar" | "gallery" | "mixed";

type TemplateRow = {
  id: string;
  template_id: string;
  scene: string;
  camera: string;
  backdrop: string;
  lighting: string;
  capture: string;
  outfit: string;
  pose: string;
  kind: Kind;
  category: string | null;
  age_tier_hint: string | null;
  source: string;
  is_active: boolean;
  rejected_at: string | null;
  rejection_reason: string | null;
  rejection_tags: string[] | null;
  created_at: string;
  updated_at: string;
};

type Stats = {
  total: number;
  active: number;
  rejected: number;
  byKind: { avatar: number; gallery: number; mixed: number };
  byCategory: Array<{ category: string; count: number }>;
  recentRejections: TemplateRow[];
};

type ListResponse = {
  ok: boolean;
  rows: TemplateRow[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
};

const REJECTION_TAG_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "te-generiek", label: "Te generiek" },
  { id: "outfit-mismatch", label: "Outfit/setting klopt niet" },
  { id: "leeftijd-issue", label: "Leeftijd-issue" },
  { id: "ongeloofwaardig", label: "Ongeloofwaardig" },
  { id: "doublure", label: "Lijkt te veel op een ander" },
  { id: "anders", label: "Anders" },
];

const PAGE_SIZE = 50;

function kindLabel(kind: Kind): string {
  if (kind === "avatar") return "Avatar";
  if (kind === "gallery") return "Galerij";
  return "Mixed";
}

function kindBadge(kind: Kind): string {
  if (kind === "avatar")
    return "bg-violet-50 text-violet-700 ring-violet-200";
  if (kind === "gallery")
    return "bg-sky-50 text-sky-700 ring-sky-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

export function SceneTemplatesPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [listOpen, setListOpen] = useState(false);
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [filterKind, setFilterKind] = useState<Kind | "any">("any");
  const [filterState, setFilterState] = useState<"active" | "rejected" | "any">(
    "active",
  );

  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);
  const [generateErr, setGenerateErr] = useState<string | null>(null);
  const [generateHints, setGenerateHints] = useState("");
  const [generateCount, setGenerateCount] = useState(50);

  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<TemplateRow | null>(null);

  // Bulk-select state. Persists across pages and filter changes so the
  // operator can flick through a few pages, checkboxing the obvious
  // bad ones, and then bulk-delete once at the end.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [selectAllLoading, setSelectAllLoading] = useState(false);

  const refreshStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin/scene-templates/stats", {
        cache: "no-store",
      });
      const data = (await res.json()) as { ok: boolean } & Stats;
      if (data.ok) {
        setStats(data);
      }
    } catch {
      // ignore — toast next time
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  const loadList = useCallback(
    async (nextPage = 1) => {
      setListLoading(true);
      setListError(null);
      try {
        const url = new URL(
          "/api/admin/scene-templates",
          window.location.origin,
        );
        url.searchParams.set("page", String(nextPage));
        url.searchParams.set("pageSize", String(PAGE_SIZE));
        url.searchParams.set("kind", filterKind);
        url.searchParams.set("state", filterState);
        const res = await fetch(url.toString(), { cache: "no-store" });
        const data = (await res.json()) as ListResponse;
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        setRows(data.rows);
        setTotal(data.total);
        setPage(data.page);
      } catch (err) {
        setListError(err instanceof Error ? err.message : String(err));
      } finally {
        setListLoading(false);
      }
    },
    [filterKind, filterState],
  );

  // Lazy-load on first open. Reload on filter changes.
  useEffect(() => {
    if (listOpen) void loadList(1);
  }, [listOpen, loadList]);

  const openList = useCallback(() => {
    setListOpen(true);
  }, []);

  const doGenerate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    setGenerateMsg(null);
    setGenerateErr(null);
    try {
      const hints = generateHints
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/scene-templates/generate-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: generateCount, hints }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        inserted?: number;
        dedupedSkipped?: number;
        droppedInvalid?: number;
        generated?: number;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setGenerateMsg(
        `${data.inserted ?? 0} nieuwe templates toegevoegd · ${data.dedupedSkipped ?? 0} doublures · ${data.droppedInvalid ?? 0} ongeldig`,
      );
      await refreshStats();
      if (listOpen) await loadList(1);
    } catch (err) {
      setGenerateErr(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }, [
    generating,
    generateCount,
    generateHints,
    refreshStats,
    listOpen,
    loadList,
  ]);

  const doSeed = useCallback(async () => {
    if (seeding) return;
    setSeeding(true);
    setSeedMsg(null);
    try {
      const res = await fetch("/api/admin/scene-templates/seed", {
        method: "POST",
      });
      const data = (await res.json()) as {
        ok: boolean;
        inserted?: number;
        skipped?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setSeedMsg(
        `Seed klaar: ${data.inserted ?? 0} ingelezen · ${data.skipped ?? 0} bestonden al`,
      );
      await refreshStats();
      if (listOpen) await loadList(1);
    } catch (err) {
      setSeedMsg(
        `Seed mislukt: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setSeeding(false);
    }
  }, [seeding, refreshStats, listOpen, loadList]);

  const onTemplateChanged = useCallback(
    (next: TemplateRow) => {
      setRows((prev) =>
        prev.map((r) => (r.id === next.id ? { ...r, ...next } : r)),
      );
      void refreshStats();
    },
    [refreshStats],
  );

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setBulkError(null);
  }, []);

  // Master checkbox: select/deselect every visible row on the current
  // page. Doesn't reach into other pages — for that the operator uses
  // the "Selecteer alle X" link in the action bar.
  const visibleRowIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allVisibleSelected =
    visibleRowIds.length > 0 &&
    visibleRowIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    !allVisibleSelected && visibleRowIds.some((id) => selectedIds.has(id));

  const togglePageSelection = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleRowIds) next.delete(id);
      } else {
        for (const id of visibleRowIds) next.add(id);
      }
      return next;
    });
  }, [allVisibleSelected, visibleRowIds]);

  const selectAllMatching = useCallback(async () => {
    if (selectAllLoading) return;
    setSelectAllLoading(true);
    setBulkError(null);
    try {
      const url = new URL(
        "/api/admin/scene-templates",
        window.location.origin,
      );
      url.searchParams.set("kind", filterKind);
      url.searchParams.set("state", filterState);
      url.searchParams.set("idsOnly", "1");
      const res = await fetch(url.toString(), { cache: "no-store" });
      const data = (await res.json()) as {
        ok: boolean;
        ids?: string[];
        error?: string;
      };
      if (!res.ok || !data.ok || !Array.isArray(data.ids)) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of data.ids ?? []) next.add(id);
        return next;
      });
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : String(err));
    } finally {
      setSelectAllLoading(false);
    }
  }, [selectAllLoading, filterKind, filterState]);

  const bulkDelete = useCallback(async () => {
    if (bulkDeleting) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const confirmed = window.confirm(
      `Weet je zeker dat je ${ids.length} template${ids.length === 1 ? "" : "s"} definitief wilt verwijderen?\n\nDit is een harde delete — de templates zijn weg, niet alleen afgewezen.`,
    );
    if (!confirmed) return;
    setBulkDeleting(true);
    setBulkError(null);
    try {
      const res = await fetch("/api/admin/scene-templates/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        deleted?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      // Remove the deleted rows from local state and clear selection.
      setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      await refreshStats();
      // Reload the current page so totals/pagination stay correct.
      await loadList(page);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkDeleting(false);
    }
  }, [bulkDeleting, selectedIds, refreshStats, loadList, page]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Stats + generate */}
      <section className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap gap-3">
            <StatBadge label="Actief" value={stats?.active ?? "—"} tone="primary" />
            <StatBadge label="Afgewezen" value={stats?.rejected ?? "—"} tone="muted" />
            <StatBadge label="Avatar" value={stats?.byKind.avatar ?? "—"} tone="violet" />
            <StatBadge label="Galerij" value={stats?.byKind.gallery ?? "—"} tone="sky" />
            <StatBadge label="Mixed" value={stats?.byKind.mixed ?? "—"} tone="amber" />
            <button
              type="button"
              onClick={() => void refreshStats()}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50"
              disabled={statsLoading}
              title="Stats opnieuw laden"
            >
              <RefreshIcon className={statsLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              ververs
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Extra wensen voor deze batch (optioneel, één regel per wens)
              <textarea
                value={generateHints}
                onChange={(e) => setGenerateHints(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder={`Bijv:\n- meer outdoor templates voor 55+\n- geen cafés\n- meer mirror-selfies in de winter`}
              />
            </label>
            {generateMsg ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                {generateMsg}
              </div>
            ) : null}
            {generateErr ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {generateErr}
              </div>
            ) : null}
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Aantal templates
              <select
                value={generateCount}
                onChange={(e) => setGenerateCount(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                disabled={generating}
              >
                {[10, 25, 50, 75].map((n) => (
                  <option key={n} value={n}>
                    {n} per batch
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void doGenerate()}
              disabled={generating}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-4 py-2.5 text-sm font-semibold text-white shadow-pill transition hover:from-primary/90 hover:to-primary/70 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <SparkleIcon className={generating ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
              {generating
                ? "Grok schrijft…"
                : `${generateCount} nieuwe genereren`}
            </button>
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-[11px] text-gray-500">
              Duurt ~20-60s afhankelijk van het aantal. De afgewezen templates
              van eerder worden automatisch als negatieve voorbeelden meegegeven.
            </div>
          </div>
        </div>
      </section>

      {/* Seed banner — only shows when DB is empty */}
      {stats && stats.total === 0 ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-amber-900">
                Eerst de in-code templates importeren
              </h2>
              <p className="mt-1 text-sm text-amber-800">
                Klik hieronder om de 83 oorspronkelijke templates uit de code in
                de DB te zetten. Daarna kun je ze net als Grok-gegenereerde
                templates rejecten / restoren.
              </p>
              {seedMsg ? (
                <p className="mt-2 text-xs text-amber-900">{seedMsg}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void doSeed()}
              disabled={seeding}
              className="shrink-0 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-pill transition hover:bg-amber-700 disabled:opacity-60"
            >
              {seeding ? "Bezig…" : "Importeer in-code templates"}
            </button>
          </div>
        </section>
      ) : null}

      {/* Lazy-loaded list */}
      <section className="rounded-3xl border border-black/5 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-6 py-4">
          <div className="flex items-center gap-2">
            {listOpen && rows.length > 0 ? (
              <input
                type="checkbox"
                checked={allVisibleSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someVisibleSelected;
                }}
                onChange={togglePageSelection}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                title="Selecteer alle op deze pagina"
              />
            ) : null}
            <CameraIcon className="h-5 w-5 text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900">
              Alle templates
            </h2>
            {listOpen ? (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {total} totaal
              </span>
            ) : null}
          </div>
          {!listOpen ? (
            <button
              type="button"
              onClick={openList}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Lijst laden
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterState}
                onChange={(e) =>
                  setFilterState(e.target.value as "active" | "rejected" | "any")
                }
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs"
              >
                <option value="active">Alleen actief</option>
                <option value="rejected">Alleen afgewezen</option>
                <option value="any">Alles</option>
              </select>
              <select
                value={filterKind}
                onChange={(e) =>
                  setFilterKind(e.target.value as Kind | "any")
                }
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs"
              >
                <option value="any">Alle soorten</option>
                <option value="avatar">Avatar</option>
                <option value="gallery">Galerij</option>
                <option value="mixed">Mixed</option>
              </select>
              <button
                type="button"
                onClick={() => void loadList(page)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                title="Lijst opnieuw laden"
              >
                <RefreshIcon className={listLoading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              </button>
            </div>
          )}
        </div>

        {!listOpen ? (
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            Klik "Lijst laden" om alle templates op te halen.
          </div>
        ) : listLoading && rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            Bezig met laden…
          </div>
        ) : listError ? (
          <div className="px-6 py-8 text-center text-sm text-rose-700">
            Fout bij laden: {listError}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            Geen templates gevonden in deze filter.
          </div>
        ) : (
          <>
            <ul className="divide-y divide-black/5">
              {rows.map((row) => (
                <TemplateRowItem
                  key={row.id}
                  row={row}
                  selected={selectedIds.has(row.id)}
                  onToggleSelect={() => toggleSelected(row.id)}
                  onChanged={onTemplateChanged}
                  onRequestReject={() => setRejectTarget(row)}
                />
              ))}
            </ul>
            {pageCount > 1 ? (
              <div className="flex items-center justify-between border-t border-black/5 px-6 py-3 text-sm text-gray-600">
                <span>
                  Pagina {page} van {pageCount}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || listLoading}
                    onClick={() => void loadList(Math.max(1, page - 1))}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  >
                    Vorige
                  </button>
                  <button
                    type="button"
                    disabled={page >= pageCount || listLoading}
                    onClick={() => void loadList(Math.min(pageCount, page + 1))}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  >
                    Volgende
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {rejectTarget ? (
        <RejectModal
          row={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirmed={(updated) => {
            onTemplateChanged(updated);
            setRejectTarget(null);
          }}
        />
      ) : null}

      {selectedIds.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 px-4 py-3 shadow-[0_-8px_20px_-12px_rgba(0,0,0,0.25)] backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-gray-900">
                {selectedIds.size} geselecteerd
              </span>
              {total > visibleRowIds.length && selectedIds.size < total ? (
                <button
                  type="button"
                  onClick={() => void selectAllMatching()}
                  disabled={selectAllLoading}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  {selectAllLoading
                    ? "Bezig…"
                    : `Selecteer alle ${total} in deze filter`}
                </button>
              ) : null}
              {bulkError ? (
                <span className="text-xs text-rose-700">{bulkError}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                disabled={bulkDeleting}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Selectie wissen
              </button>
              <button
                type="button"
                onClick={() => void bulkDelete()}
                disabled={bulkDeleting}
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-pill transition hover:bg-rose-700 disabled:opacity-60"
              >
                <TrashIcon className="h-4 w-4" />
                {bulkDeleting
                  ? "Verwijderen…"
                  : `Verwijder ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "primary" | "muted" | "violet" | "sky" | "amber";
}) {
  const toneCls =
    tone === "primary"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : tone === "muted"
        ? "bg-gray-50 text-gray-700 ring-gray-200"
        : tone === "violet"
          ? "bg-violet-50 text-violet-800 ring-violet-200"
          : tone === "sky"
            ? "bg-sky-50 text-sky-800 ring-sky-200"
            : "bg-amber-50 text-amber-800 ring-amber-200";
  return (
    <div
      className={`flex items-baseline gap-2 rounded-2xl px-3 py-1.5 text-sm ring-1 ${toneCls}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wider opacity-75">
        {label}
      </span>
      <span className="text-base font-semibold">{value}</span>
    </div>
  );
}

function TemplateRowItem({
  row,
  selected,
  onToggleSelect,
  onChanged,
  onRequestReject,
}: {
  row: TemplateRow;
  selected: boolean;
  onToggleSelect: () => void;
  onChanged: (next: TemplateRow) => void;
  onRequestReject: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Test-render state. Lives at row level so each row can have its
  // own active preview without interfering with siblings.
  const [testOpen, setTestOpen] = useState(false);
  const [testPreset, setTestPreset] = useState<string>("mid-average");
  const [testRendering, setTestRendering] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    url: string;
    subject: string;
    seed: number;
  } | null>(null);

  const onRestore = useCallback(async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const res = await fetch(
        `/api/admin/scene-templates/${encodeURIComponent(row.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "restore" }),
        },
      );
      const data = (await res.json()) as {
        ok: boolean;
        template?: TemplateRow;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.template) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onChanged(data.template);
    } catch {
      // silent for now
    } finally {
      setRestoring(false);
    }
  }, [restoring, row.id, onChanged]);

  const onTestRender = useCallback(async () => {
    if (testRendering) return;
    setTestRendering(true);
    setTestError(null);
    try {
      const res = await fetch(
        `/api/admin/scene-templates/${encodeURIComponent(row.id)}/test-render`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preset: testPreset }),
        },
      );
      const data = (await res.json()) as {
        ok: boolean;
        url?: string;
        subject?: string;
        seed?: number;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.url) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setTestResult({
        url: data.url,
        subject: data.subject ?? "preview",
        seed: data.seed ?? 0,
      });
    } catch (err) {
      setTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setTestRendering(false);
    }
  }, [row.id, testPreset, testRendering]);

  return (
    <li className={`px-6 py-4 ${selected ? "bg-primary/5" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
          aria-label={`Selecteer template ${row.template_id.slice(0, 8)}`}
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ring-1 ${kindBadge(row.kind)}`}
            >
              {kindLabel(row.kind)}
            </span>
            {!row.is_active ? (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                Afgewezen
              </span>
            ) : null}
            {row.category ? (
              <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600 ring-1 ring-gray-200">
                {row.category}
              </span>
            ) : null}
            <span className="text-[11px] text-gray-400">
              {row.source === "seed" ? "seed" : "grok"} · {row.template_id.slice(0, 8)}
            </span>
          </div>
          <div className="mt-1.5 text-sm font-medium text-gray-900">
            {row.scene}
          </div>
          {!expanded ? (
            <div className="mt-0.5 line-clamp-2 text-xs text-gray-500">
              {row.outfit}
            </div>
          ) : null}
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setTestOpen((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              testOpen
                ? "border-primary bg-primary/10 text-primary"
                : "border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
            title="Test render"
          >
            <CameraIcon className="h-3.5 w-3.5" />
          </button>
          {row.is_active ? (
            <button
              type="button"
              onClick={onRequestReject}
              className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
              title="Reject met reden"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onRestore()}
              disabled={restoring}
              className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
              title="Weer activeren"
            >
              <CheckIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {testOpen ? (
        <div className="mt-3 rounded-2xl border border-black/5 bg-white p-4 ring-1 ring-black/5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 min-w-[200px] text-xs font-medium text-gray-700">
              Test-persona
              <select
                value={testPreset}
                onChange={(e) => setTestPreset(e.target.value)}
                disabled={testRendering}
                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
              >
                {TEST_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void onTestRender()}
              disabled={testRendering}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white shadow-pill transition hover:bg-primary/90 disabled:opacity-60"
            >
              {testRendering
                ? "Renderen…"
                : testResult
                  ? "Opnieuw renderen"
                  : "Genereer voorbeeld"}
            </button>
            {testResult ? (
              <span className="text-[11px] text-gray-500">
                seed {testResult.seed} · {testResult.subject}
              </span>
            ) : null}
          </div>

          {testError ? (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
              {testError}
            </div>
          ) : null}

          {testRendering && !testResult ? (
            <div className="mt-3 flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-500">
              Diffusion model bezig… kan 20-40s duren
            </div>
          ) : null}

          {testResult ? (
            <div className="mt-3">
              <div className="relative overflow-hidden rounded-xl ring-1 ring-black/5">
                <Image
                  src={testResult.url}
                  alt={`Test render van ${row.scene.slice(0, 40)}`}
                  width={512}
                  height={640}
                  className="h-auto w-full object-cover"
                  unoptimized
                />
              </div>
              <a
                href={testResult.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-block text-[11px] text-gray-500 hover:text-gray-900"
              >
                open in nieuw tabblad ↗
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {expanded ? (
        <div className="mt-3 grid gap-2 rounded-xl border border-black/5 bg-gray-50/50 p-3 text-xs sm:grid-cols-2">
          <Field label="camera" value={row.camera} />
          <Field label="backdrop" value={row.backdrop} />
          <Field label="lighting" value={row.lighting} />
          <Field label="capture" value={row.capture} />
          <Field label="outfit" value={row.outfit} />
          <Field label="pose" value={row.pose} />
          {row.rejection_reason ? (
            <div className="sm:col-span-2">
              <Field
                label="reden van afwijzing"
                value={row.rejection_reason}
                tone="rose"
              />
              {row.rejection_tags && row.rejection_tags.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.rejection_tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-medium text-rose-700"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "rose";
}) {
  return (
    <div>
      <div
        className={`text-[10px] font-semibold uppercase tracking-wider ${tone === "rose" ? "text-rose-700" : "text-gray-400"}`}
      >
        {label}
      </div>
      <div
        className={`mt-0.5 ${tone === "rose" ? "text-rose-900" : "text-gray-700"}`}
      >
        {value}
      </div>
    </div>
  );
}

function RejectModal({
  row,
  onClose,
  onConfirmed,
}: {
  row: TemplateRow;
  onClose: () => void;
  onConfirmed: (updated: TemplateRow) => void;
}) {
  const [reason, setReason] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleTag = useCallback((tagId: string) => {
    setTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId],
    );
  }, []);

  const submit = useCallback(async () => {
    if (submitting) return;
    const trimmed = reason.trim();
    if (trimmed.length < 4) {
      setError("Reden is te kort (min. 4 tekens).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/scene-templates/${encodeURIComponent(row.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reject", reason: trimmed, tags }),
        },
      );
      const data = (await res.json()) as {
        ok: boolean;
        template?: TemplateRow;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.template) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onConfirmed(data.template);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [reason, tags, submitting, row.id, onConfirmed]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Template afwijzen
            </h2>
            <p className="mt-1 line-clamp-2 text-xs text-gray-500">
              {row.scene}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-4 block text-sm font-medium text-gray-700">
          Waarom is deze template niet goed?
          <textarea
            ref={textareaRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Bijv: outfit (badpak) past niet bij setting (zakelijke meeting)…"
          />
        </label>

        <div className="mt-3">
          <div className="text-xs font-medium text-gray-700">
            Categorie (optioneel, één of meer)
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {REJECTION_TAG_OPTIONS.map((tag) => {
              const active = tags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                    active
                      ? "bg-primary text-white ring-primary"
                      : "bg-white text-gray-700 ring-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Annuleren
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-pill transition hover:bg-rose-700 disabled:opacity-60"
          >
            {submitting ? "Bezig…" : "Afwijzen"}
          </button>
        </div>
      </div>
    </div>
  );
}
