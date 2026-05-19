"use client";

export function CatalogFallbackBanner({
  show,
  compact = false,
}: {
  show: boolean;
  compact?: boolean;
}) {
  if (!show) return null;
  return (
    <div
      role="status"
      className={
        compact
          ? "mx-4 mt-1 shrink-0 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-950 ring-1 ring-amber-200/90"
          : "mx-5 mt-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] leading-snug text-amber-950 ring-1 ring-amber-200/90"
      }
    >
      Profielen konden niet van de server worden geladen. Er wordt demodata
      getoond — controleer je verbinding of de Supabase-catalogus.
    </div>
  );
}
