/**
 * Shared ASCORA color tokens for pages that build their own
 * inline-styled layouts (Auth, Test, Landing). Mirrors the
 * CSS custom properties defined in src/index.css so every
 * page — old and new — reads from one palette.
 */
export const C = {
  bg: "#070b14",
  bgDeep: "#04070d",
  panel: "rgba(15, 23, 42, 0.62)",
  panelStrong: "rgba(16, 26, 48, 0.94)",
  border: "rgba(148, 163, 184, 0.14)",
  borderStrong: "rgba(148, 163, 184, 0.26)",

  text: "#f4f7fb",
  muted: "#8d99ad",
  mutedStrong: "#b3bdcd",

  cyan: "#38bdf8",
  cyanSoft: "rgba(56, 189, 248, 0.12)",
  violet: "#8b5cf6",
  violetSoft: "rgba(139, 92, 246, 0.12)",
  amber: "#f5a524",
  amberSoft: "rgba(245, 165, 36, 0.12)",
  green: "#34d399",
  greenSoft: "rgba(52, 211, 153, 0.12)",
  red: "#f87171",
  redSoft: "rgba(248, 113, 113, 0.12)",
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  full: 999,
};