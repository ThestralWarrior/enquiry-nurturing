import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep, premium "ink" navy base
        ink: {
          950: "#070a14",
          900: "#0b1020",
          800: "#111834",
          700: "#1b2547",
          600: "#293563",
        },
        // Warm gold accent — high-end real estate signal
        gold: {
          300: "#f6d98a",
          400: "#f0c65f",
          500: "#e6b23e",
          600: "#c9962b",
        },
        brand: {
          400: "#6ea8ff",
          500: "#3f7dfb",
          600: "#2f63e0",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(7,10,20,0.06), 0 8px 24px -12px rgba(7,10,20,0.18)",
        lift: "0 20px 60px -24px rgba(9,14,34,0.45)",
        glow: "0 0 0 1px rgba(240,198,95,0.35), 0 8px 30px -8px rgba(240,198,95,0.35)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.7" },
          "80%, 100%": { transform: "scale(2.2)", opacity: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "bounce-dot": {
          "0%, 80%, 100%": { transform: "scale(0.6)", opacity: "0.4" },
          "40%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        blink: "blink 1s step-end infinite",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.24,0,0.38,1) infinite",
        shimmer: "shimmer 1.6s infinite",
        "bounce-dot": "bounce-dot 1.2s infinite ease-in-out",
      },
    },
  },
  plugins: [],
};

export default config;
