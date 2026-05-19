import type { AppVariant } from "@/lib/app-variant";

const selectedRing =
  "border-2 border-[var(--funnel-accent)] ring-2 ring-[var(--funnel-accent)]/30";

/** Large choice row (gender, seeking). */
export function funnelChoiceRowClass(
  variant: AppVariant,
  selected: boolean,
  v1Bg: string,
): string {
  const base =
    "flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left transition active:scale-[0.98]";
  if (variant === "v2") {
    return `${base} ${
      selected
        ? `bg-[#353536] ${selectedRing}`
        : "border border-white/10 bg-[#2A2A2B]"
    }`;
  }
  return `${base} ${v1Bg} ${
    selected ? selectedRing : "border border-gray-200"
  }`;
}

/** Compact choice row (“Waar kom je voor?”). */
export function funnelLookingForRowClass(
  variant: AppVariant,
  selected: boolean,
  v1CardBg: string,
  v1CardBorder: string,
): string {
  const base =
    "flex w-full min-h-0 items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left transition active:scale-[0.98]";
  if (variant === "v2") {
    return `${base} ${
      selected
        ? `bg-[#353536] ${selectedRing}`
        : "border border-white/10 bg-[#2A2A2B]"
    }`;
  }
  return `${base} ${v1CardBg} ${
    selected ? selectedRing : `border ${v1CardBorder}`
  }`;
}

export function funnelEmojiTileClass(
  variant: AppVariant,
  v1TileBg: string,
): string {
  const base =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl";
  return variant === "v2" ? `${base} bg-[#1D1D1E]` : `${base} ${v1TileBg}`;
}

export function funnelStepTitleClass(variant: AppVariant): string {
  return variant === "v2"
    ? "text-balance text-3xl font-extrabold leading-tight text-ink"
    : "text-balance text-3xl font-extrabold leading-tight text-gray-900";
}

export function funnelStepSubtitleClass(variant: AppVariant): string {
  return variant === "v2"
    ? "mt-1 text-[13px] leading-snug text-inkMuted"
    : "mt-1 text-[13px] leading-snug text-gray-600";
}

export function funnelOptionTitleClass(
  variant: AppVariant,
  size: "md" | "lg" = "lg",
): string {
  if (variant === "v2") {
    return size === "lg"
      ? "block text-[18px] font-extrabold text-ink"
      : "block font-bold text-[14px] leading-snug text-ink";
  }
  return size === "lg"
    ? "block text-[18px] font-extrabold text-gray-900"
    : "block font-bold text-[14px] leading-snug text-gray-900";
}

export function funnelOptionSubClass(variant: AppVariant): string {
  return variant === "v2"
    ? "mt-0.5 block text-[11px] leading-snug text-inkMuted"
    : "mt-0.5 block text-[11px] leading-snug text-gray-600";
}

export function funnelOptionSubClassSm(variant: AppVariant): string {
  return variant === "v2"
    ? "block text-[12px] text-inkMuted"
    : "block text-[12px] text-gray-500";
}
