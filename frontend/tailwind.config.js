/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Sənayə-üslublu palitra: tünd yaşıl-boz əsas, isti vurğular,
      // generic AI gradient-lərindən qaçırıq.
      colors: {
        ink: {
          50:  "#f6f5f3",
          100: "#e9e7e2",
          200: "#cfccc4",
          300: "#a8a397",
          400: "#7a7466",
          500: "#5a5547",
          600: "#403c30",
          700: "#2d2a21",
          800: "#1d1b15",
          900: "#11100c",
        },
        paper: {
          DEFAULT: "#faf8f3",
          100:     "#f5f2ea",
          200:     "#ebe6d8",
        },
        moss: {
          50:  "#eef3ec",
          100: "#d2dccc",
          200: "#a5b89c",
          300: "#7b9870",
          400: "#587852",
          500: "#3d5a3b",
          600: "#2f4630",
          700: "#243523",
          800: "#1a261a",
        },
        clay: {
          100: "#ede2d0",
          200: "#d6c2a3",
          300: "#b89c6f",
          400: "#946d3f",
          500: "#6f4d28",
        },
        rust: {
          400: "#c25a3a",
          500: "#a04525",
          600: "#7d321a",
        },
        sun: {
          400: "#e8b13a",
          500: "#c8902a",
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', "Georgia", "serif"],
        sans:    ['"Geist"', "Inter", "system-ui", "sans-serif"],
        mono:    ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(29,27,21,0.04), 0 8px 24px -12px rgba(29,27,21,0.18)",
        deep: "0 8px 40px -16px rgba(29,27,21,0.4)",
      },
      borderRadius: {
        soft: "10px",
      },
    },
  },
  plugins: [],
};
