import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebar: {
          DEFAULT: "#1A1A2E",
          hover: "#16213E",
          active: "#0F3460",
        },
        primary: {
          DEFAULT: "#5B8FF9",
          dark: "#4A7CE8",
          light: "#EEF3FF",
        },
        background: "#F0F1F5",
        surface: "#FFFFFF",
        border: "#E5E7EB",
        "text-primary": "#26264F",
        "text-secondary": "#8B8BAE",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",

        // Dashdark X theme tokens (resolve to CSS variables; flip with light/dark)
        "dx-bg": "var(--dx-bg)",
        "dx-surface": "var(--dx-surface)",
        "dx-surface-2": "var(--dx-surface-2)",
        "dx-surface-hover": "var(--dx-surface-hover)",
        "dx-line": "var(--dx-line)",
        "dx-ink": "var(--dx-ink)",
        "dx-ink-muted": "var(--dx-ink-muted)",
        "dx-ink-faint": "var(--dx-ink-faint)",
        "dx-accent": "var(--dx-accent)",
        "dx-accent-2": "var(--dx-accent-2)",
        "dx-success": "var(--dx-success)",
        "dx-danger": "var(--dx-danger)",
        "dx-warning": "var(--dx-warning)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
