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
          950: "#060910",
        },
        charcoal: {
          900: "#0c0e14",
          800: "#13161e",
          700: "#1b1f2a",
          600: "#262b38",
        },
        glow: {
          indigo: "#7c83f0",
          violet: "#9d80e8",
        },
      },
    },
  },
  plugins: [],
};
export default config;
