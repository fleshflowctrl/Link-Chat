/**
 * V2 theme — bold red accent on dark gray (kinky / discreet).
 */
export const V2_THEME = {
  red: "#B52B2A",
  redHover: "#D63B3A",
  redSoft: "#C93535",
  bg: "#121214",
  bgElevated: "#1A1A1B",
  bgSurface: "#2A2A2B",
  text: "#F5F5F5",
  textMuted: "#9B9B9B",
  border: "rgba(181, 43, 42, 0.28)",
} as const;

export const V2_GRADIENT_PRIMARY =
  `linear-gradient(135deg, ${V2_THEME.red} 0%, ${V2_THEME.redSoft} 100%)`;

export const V2_GRADIENT_RING =
  `linear-gradient(135deg, ${V2_THEME.red} 0%, ${V2_THEME.redSoft} 55%, ${V2_THEME.redHover} 100%)`;
