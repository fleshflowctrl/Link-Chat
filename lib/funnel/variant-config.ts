import type { AppVariant } from "@/lib/app-variant";
import { withVariantPath } from "@/lib/app-variant";
import { V2_THEME } from "@/lib/v2-theme";

export type FunnelVariantConfig = {
  variant: AppVariant;
  discoverPath: string;
  signupPath: string;
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
      signupPath: `${withVariantPath("/signup", variant)}?next=${loginNext}`,
      loginPath: `${withVariantPath("/login", variant)}?next=${loginNext}`,
      helpPath: withVariantPath("/me/help", variant),
      privacyPath: withVariantPath("/me/privacy", variant),
      outerBg: "bg-[#0F1218]",
      cardBg: "bg-[#171B24]",
      headerBg: "bg-[#1E2430]/95 border-[#C4A77D]/15",
      accent: V2_THEME.red,
      accentSoft: V2_THEME.redSoft,
    };
  }

  return {
    variant,
    discoverPath,
    signupPath: `${withVariantPath("/signup", variant)}?next=${loginNext}`,
    loginPath: `${withVariantPath("/login", variant)}?next=${loginNext}`,
    helpPath: withVariantPath("/me/help", variant),
    privacyPath: withVariantPath("/me/privacy", variant),
    outerBg: "bg-[#E4DFD4]",
    cardBg: "bg-[#F5F3EE]",
    headerBg: "bg-[#F5F3EE]/95 border-black/[0.04]",
    accent: "#7C5CFF",
    accentSoft: "#9B7BFF",
  };
}
