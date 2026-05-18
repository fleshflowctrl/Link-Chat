import type { AppVariant } from "@/lib/app-variant";
import { withVariantPath } from "@/lib/app-variant";

export type FunnelVariantConfig = {
  variant: AppVariant;
  discoverPath: string;
  loginPath: string;
  helpPath: string;
  privacyPath: string;
  outerBg: string;
  cardBg: string;
  headerBg: string;
  accent: string;
  accentSoft: string;
};

export function getFunnelVariantConfig(variant: AppVariant): FunnelVariantConfig {
  const discoverPath = withVariantPath("/discover", variant);
  const loginNext = encodeURIComponent(discoverPath);

  if (variant === "v2") {
    return {
      variant,
      discoverPath,
      loginPath: `/login?next=${loginNext}`,
      helpPath: withVariantPath("/me/help", variant),
      privacyPath: withVariantPath("/me/privacy", variant),
      outerBg: "bg-[#0f0e0c]",
      cardBg: "bg-[#1a1816]",
      headerBg: "bg-[#141210]/95 border-[#c9a227]/10",
      accent: "#C9A227",
      accentSoft: "#E8D48B",
    };
  }

  return {
    variant,
    discoverPath,
    loginPath: `/login?next=${loginNext}`,
    helpPath: withVariantPath("/me/help", variant),
    privacyPath: withVariantPath("/me/privacy", variant),
    outerBg: "bg-[#E4DFD4]",
    cardBg: "bg-[#F5F3EE]",
    headerBg: "bg-[#F5F3EE]/95 border-black/[0.04]",
    accent: "#7C5CFF",
    accentSoft: "#9B7BFF",
  };
}
