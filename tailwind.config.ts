import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ["var(--font-heading)", "Caprasimo", "serif"],
        adminHeading: ["var(--font-admin-heading)", "Space Grotesk", "sans-serif"],
        body: ["var(--font-body)", "Figtree", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      colors: {
        // Revizz brand tokens
        brand: {
          yellow: { DEFAULT: "#FACC15", light: "#FEF08A", dark: "#CA8A04" },
          teal: { DEFAULT: "#14B8A6", light: "#99F6E4", dark: "#0F766E" },
          coral: { DEFAULT: "#FB7185", light: "#FECDD3", dark: "#E11D48" },
          indigo: { DEFAULT: "#6366F1", light: "#C7D2FE", dark: "#4338CA" },
          green: { DEFAULT: "#22C55E", light: "#BBF7D0", dark: "#15803D" },
          amber: { DEFAULT: "#F59E0B", light: "#FDE68A", dark: "#D97706" },
        },
        // Organic design system tokens
        bg: "#f5ead8",
        surface: "#ebddc5",
        text: "#201e1d",
        accent: {
          DEFAULT: "#c67139",
          100: "#fff2eb",
          200: "#ffe1d0",
          300: "#ffc6a5",
          400: "#f6a06b",
          500: "#d67f48",
          600: "#b2622d",
          700: "#8c491a",
          800: "#643312",
          900: "#402310",
        },
        "accent-2": {
          DEFAULT: "#7a8a5e",
          100: "#f0fae1",
          200: "#e1eecc",
          300: "#ccdbb2",
          400: "#aebf92",
          500: "#8fa073",
          600: "#728157",
          700: "#56633f",
          800: "#3d472b",
          900: "#272e1b",
        },
        accent2: {
          DEFAULT: "#7a8a5e",
          100: "#f0fae1",
          200: "#e1eecc",
          300: "#ccdbb2",
          400: "#aebf92",
          500: "#8fa073",
          600: "#728157",
          700: "#56633f",
          800: "#3d472b",
          900: "#272e1b",
        },
        neutral: {
          100: "#f9f4ed",
          200: "#eee7db",
          300: "#dcd3c4",
          400: "#c0b6a5",
          500: "#a19786",
          600: "#82796a",
          700: "#645c50",
          800: "#474238",
          900: "#2e2b25",
        },
      },
      borderRadius: {
        sm: "8px",
        md: "16px",
        lg: "28px",
        full: "999px",
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        tactile: "0 1px 3px rgba(32,30,29,0.08), 0 4px 12px rgba(32,30,29,0.05)",
        hud: "0 8px 32px -8px rgba(32,30,29,0.12), inset 0 1px 0 rgba(255,255,255,0.7)",
        "glow-terracotta": "0 0 20px -3px rgba(198,113,57,0.3)",
        "glow-emerald": "0 0 20px -3px rgba(114,129,87,0.35)",
        "offset-2": "2px 2px 0 #201e1d",
        "offset-3": "3px 3px 0 #201e1d",
        "offset-4": "4px 4px 0 #201e1d",
        "offset-6": "6px 6px 0 #201e1d",
        chunky: "2px 2px 0 #201e1d",
        "chunky-lg": "4px 4px 0 #201e1d",
        playful: "0 8px 0 0 rgba(0, 0, 0, 0.06)",
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-5px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(5px)" },
        },
      },
      animation: {
        shake: "shake 0.5s ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
