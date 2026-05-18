/**
 * V2 visual theme — aligned with FetLife's dark shell + brick-red accent.
 * @see https://fetlife.com
 */
export const V2_THEME = {
  /** Signature FetLife red */
  red: "#B52B2A",
  redHover: "#C93535",
  redSoft: "#D63B3A",
  /** Near-black backgrounds */
  bg: "#1D1D1E",
  bgElevated: "#252526",
  bgSurface: "#2A2A2B",
  /** Typography */
  text: "#E8E8E8",
  textMuted: "#9B9B9B",
  border: "rgba(181, 43, 42, 0.25)",
} as const;

export const V2_GRADIENT_PRIMARY =
  `linear-gradient(135deg, ${V2_THEME.red} 0%, ${V2_THEME.redSoft} 100%)`;

export const V2_GRADIENT_RING =
  `linear-gradient(135deg, ${V2_THEME.red} 0%, ${V2_THEME.redSoft} 55%, ${V2_THEME.redHover} 100%)`;
