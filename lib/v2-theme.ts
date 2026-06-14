/**
 * Premium discreet theme — executive lounge feel for divorced professionals.
 */
export const V2_THEME = {
  /** Warm champagne gold accent */
  red: "#C4A77D",
  redHover: "#D4B88F",
  redSoft: "#B8956A",
  /** Deep slate backgrounds */
  bg: "#0F1218",
  bgElevated: "#171B24",
  bgSurface: "#1E2430",
  /** Typography */
  text: "#F0EDE8",
  textMuted: "#9CA3AF",
  border: "rgba(196, 167, 125, 0.22)",
} as const;

export const V2_GRADIENT_PRIMARY =
  `linear-gradient(135deg, ${V2_THEME.red} 0%, ${V2_THEME.redSoft} 100%)`;

export const V2_GRADIENT_RING =
  `linear-gradient(135deg, ${V2_THEME.red} 0%, ${V2_THEME.redSoft} 55%, ${V2_THEME.redHover} 100%)`;
