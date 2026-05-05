"use client";

export function CatalogFallbackBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      role="status"
      className="mx-5 mt-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] leading-snug text-amber-950 ring-1 ring-amber-200/90"
    >
      Couldn&apos;t load profiles from the server. Showing demo data — check your
      connection or Supabase catalog.
    </div>
  );
}
