import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        slate: {
          950: "var(--color-bg-base)",
        },
        carbon: {
          950: "var(--color-bg-base)",
          900: "var(--color-bg-raised)",
          800: "var(--color-bg-elevated)",
          700: "var(--color-bg-overlay)",
          600: "var(--color-bg-hover)",
        },
        charcoal: {
          900: "var(--color-bg-raised)",
          800: "var(--color-bg-elevated)",
          700: "var(--color-bg-overlay)",
          600: "var(--color-bg-hover)",
        },
        glow: {
          indigo: "var(--color-accent-indigo)",
          cyan: "var(--color-accent-cyan)",
        },
        brand: {
          indigo: "var(--color-accent-indigo)",
          "indigo-bright": "var(--color-accent-indigo-bright)",
          cyan: "var(--color-accent-cyan)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        eyebrow: "0.22em",
        label: "0.14em",
      },
      boxShadow: {
        "elev-1": "0 2px 8px -2px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
        "elev-2": "0 8px 24px -8px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.35)",
        "elev-3": "0 24px 60px -16px rgba(0,0,0,0.65), 0 8px 18px rgba(0,0,0,0.4)",
        "glow-indigo": "0 0 32px -4px rgba(99,102,241,0.45)",
        "glow-indigo-lg": "0 0 64px -8px rgba(99,102,241,0.55)",
        "glow-cyan": "0 0 32px -4px rgba(6,182,212,0.45)",
        "glow-cyan-lg": "0 0 64px -8px rgba(6,182,212,0.55)",
      },
      animation: {
        "orb-drift-1": "orb-drift-1 28s ease-in-out infinite",
        "orb-drift-2": "orb-drift-2 36s ease-in-out infinite",
        "orb-drift-3": "orb-drift-3 44s ease-in-out infinite",
        shimmer: "shimmer 1.8s linear infinite",
      },
      keyframes: {
        "orb-drift-1": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(8%, -6%, 0) scale(1.08)" },
        },
        "orb-drift-2": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(-7%, 5%, 0) scale(1.05)" },
        },
        "orb-drift-3": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(0.98)" },
          "50%": { transform: "translate3d(5%, 7%, 0) scale(1.04)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
