import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./data/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#F5F3EE",
        ink: "#2B2B2B",
        inkMuted: "#5C5C5C",
        primary: "#7C5CFF",
        primarySoft: "#9B7BFF",
        accentPink: "#FF6B9D",
        accentOrange: "#FF8A4C",
        accentGreen: "#22C55E",
        lavender: "#EDE8FF",
        lavenderDeep: "#E4DCFF",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 10px 40px -12px rgba(124, 92, 255, 0.18), 0 4px 16px -8px rgba(0,0,0,0.08)",
        cardHover: "0 14px 48px -10px rgba(124, 92, 255, 0.22), 0 8px 24px -8px rgba(0,0,0,0.1)",
        pill: "0 4px 14px -4px rgba(124, 92, 255, 0.25)",
        fab: "0 12px 32px -8px rgba(124, 92, 255, 0.45)",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #7C5CFF 0%, #9B7BFF 100%)",
        "gradient-ring":
          "linear-gradient(135deg, #7C5CFF 0%, #9B7BFF 55%, #FF6B9D 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
