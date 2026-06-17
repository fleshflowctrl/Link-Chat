import type { Profile } from "@/data/profiles";
import { profiles } from "@/data/profiles";
import type { AppVariant } from "@/lib/app-variant";
import { DEFAULT_APP_VARIANT, parseAppVariant } from "@/lib/app-variant";

/** Static demo catalog — v1 only; v2 must never show bundled v1 placeholders. */
export function staticCatalogProfiles(variant: AppVariant): Profile[] {
  return variant === "v2" ? [] : profiles;
}

export function chatProfileMatchesVariant(
  row: { app_variant?: string | null } | null | undefined,
  variant: AppVariant,
): boolean {
  if (!row) return false;
  return parseAppVariant(row.app_variant ?? null) === variant;
}

/** Supabase query filter for the active app pool. */
export function applyChatProfilesVariantFilter<T>(
  query: T,
  variant: AppVariant = DEFAULT_APP_VARIANT,
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = query as any;
  return q.eq("app_variant", variant) as T;
}

type ChatProfileRowLike = { is_archived?: boolean | null } | null | undefined;

/** Profile/chat open by id — discover mixes v1+v2 live personas. */
export function applyChatProfileIdLookupFilter<T>(query: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = query as any;
  return q.eq("is_archived", false) as T;
}

export function isResolvableChatProfileRow(
  row: ChatProfileRowLike,
): row is { is_archived?: boolean | null } {
  return row != null && row.is_archived !== true;
}

/** Discover / home feed — only admin live-map personas (`online_now`). */
export function applyLiveDiscoverPoolFilter<T>(query: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = query as any;
  return q.eq("online_now", true).eq("is_archived", false) as T;
}

export function applyDiscoverPoolFilters<T>(
  query: T,
  options: { variant: AppVariant; allLiveVariants?: boolean },
): T {
  if (options.allLiveVariants) {
    return applyLiveDiscoverPoolFilter(query);
  }
  return applyLiveDiscoverPoolFilter(
    applyChatProfilesVariantFilter(query, options.variant),
  );
}
