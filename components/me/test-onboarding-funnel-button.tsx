"use client";

import { useAppVariant } from "@/components/app-variant-provider";

export function TestOnboardingFunnelButton({
  onClick,
}: {
  onClick: () => void;
}) {
  const { variant } = useAppVariant();
  const isV2 = variant === "v2";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-3 flex w-full items-center justify-center rounded-2xl border border-dashed py-3 text-[13px] font-semibold shadow-sm transition active:scale-95 ${
        isV2
          ? "border-white/20 bg-[#353536] text-inkMuted hover:text-ink"
          : "border-gray-300 bg-white/90 text-gray-600"
      }`}
    >
      Test onboarding funnel
    </button>
  );
}
