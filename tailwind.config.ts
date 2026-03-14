import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mission Control custom colors
        background: {
          DEFAULT: "#0a0e1a",
          secondary: "#111827",
          card: "#1a1f35",
          elevated: "#252d45",
        },
        border: {
          DEFAULT: "#2d3748",
          active: "#3b82f6",
        },
        text: {
          primary: "#f9fafb",
          secondary: "#9ca3af",
          muted: "#6b7280",
        },
        status: {
          active: "#10b981",
          progress: "#f59e0b",
          idle: "#3b82f6",
          error: "#ef4444",
          planning: "#8b5cf6",
        },
        accent: {
          primary: "#3b82f6",
          secondary: "#8b5cf6",
          highlight: "#06b6d4",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
