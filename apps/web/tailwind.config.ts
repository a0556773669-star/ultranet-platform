import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        teal: "#1a8a76",
        "teal-dark": "#0f6e56",
        "teal-light": "#22b09a",
        "teal-bg": "#e0f0ed",
        purple: "#8e44ad",
        ink: "#1a2332",
        muted: "#5a6a7e",
        "card-border": "#dde3ec",
        page: "#f0f2f5",
      },
      fontFamily: {
        sans: ["var(--font-heebo)", "Heebo", "sans-serif"],
      },
      borderRadius: {
        card: "14px",
      },
      boxShadow: {
        card: "0 2px 8px 0 rgba(0,0,0,0.07)",
        primary: "0 4px 14px 0 rgba(26,138,118,0.3)",
      },
    },
  },
  plugins: [],
};
export default config;
