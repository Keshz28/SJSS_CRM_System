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

        // Shared theme colours; RGB channels support Tailwind opacity modifiers.
        "dx-bg": "rgb(var(--dx-bg-rgb) / <alpha-value>)",
        "dx-surface": "rgb(var(--dx-surface-rgb) / <alpha-value>)",
        "dx-surface-2": "rgb(var(--dx-surface-2-rgb) / <alpha-value>)",
        "dx-surface-hover": "rgb(var(--dx-surface-hover-rgb) / <alpha-value>)",
        "dx-line": "rgb(var(--dx-line-rgb) / <alpha-value>)",
        "dx-ink": "rgb(var(--dx-ink-rgb) / <alpha-value>)",
        "dx-ink-muted": "rgb(var(--dx-ink-muted-rgb) / <alpha-value>)",
        "dx-ink-faint": "rgb(var(--dx-ink-faint-rgb) / <alpha-value>)",
        "dx-action": "rgb(var(--dx-action-rgb) / <alpha-value>)",
        "dx-action-2": "rgb(var(--dx-action-2-rgb) / <alpha-value>)",
        "dx-accent": "rgb(var(--dx-accent-rgb) / <alpha-value>)",
        "dx-accent-2": "rgb(var(--dx-accent-2-rgb) / <alpha-value>)",
        "dx-success": "rgb(var(--dx-success-rgb) / <alpha-value>)",
        "dx-danger": "rgb(var(--dx-danger-rgb) / <alpha-value>)",
        "dx-warning": "rgb(var(--dx-warning-rgb) / <alpha-value>)",
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
