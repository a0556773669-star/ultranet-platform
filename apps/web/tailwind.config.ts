import type { Config } from "tailwindcss";

const config: Config = {
    content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
    theme: {
          extend: {
                  colors: {
                            teal: "#1a8a76",
                            "teal-dark": "#0f6e56",
                            purple: "#8e44ad",
                  },
          },
    },
    plugins: [],
};

export default config;
