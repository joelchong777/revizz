import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: { DEFAULT: "#FACC15", light: "#FEF08A", dark: "#CA8A04" },
          teal: { DEFAULT: "#14B8A6", light: "#99F6E4", dark: "#0F766E" },
          coral: { DEFAULT: "#FB7185", light: "#FECDD3", dark: "#E11D48" },
          indigo: { DEFAULT: "#6366F1", light: "#C7D2FE", dark: "#4338CA" },
          green: { DEFAULT: "#22C55E", light: "#BBF7D0", dark: "#15803D" },
          amber: { DEFAULT: "#F59E0B", light: "#FDE68A", dark: "#D97706" },
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'chunky': '0 4px 0 0 rgba(0, 0, 0, 0.1)',
        'chunky-lg': '0 6px 0 0 rgba(0, 0, 0, 0.12)',
        'playful': '0 8px 0 0 rgba(0, 0, 0, 0.06)',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
        }
      },
      animation: {
        shake: 'shake 0.5s ease-in-out',
      }
    },
  },
  plugins: [],
};

export default config;
