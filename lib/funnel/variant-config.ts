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
      outerBg: "bg-[#121214]",
      cardBg: "bg-[#1A1A1B]",
      headerBg: "bg-[#2A2A2B]/95 border-[#B52B2A]/20",
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
