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
        ink: {
          950: "#0b1120",
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
        },
        brand: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#b7cdff",
          300: "#8fadff",
          400: "#6489fa",
          500: "#4267ee",
          600: "#2f4dd0",
          700: "#263ba8",
          800: "#213386",
          900: "#1f2f6b",
        },
        accent: {
          500: "#17b58f",
          600: "#119c79",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 1px rgb(15 23 42 / 0.06)",
        panel: "0 4px 24px -4px rgb(15 23 42 / 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
