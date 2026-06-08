/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Results App ilə uyğun palitra: indigo → bənövşəyi → çəhrayı.
      // Token adları (ink/paper/moss/clay/rust/sun) saxlanılıb — bütün
      // mövcud səhifələr avtomatik yeni rənglərə keçir.
      colors: {
        // Mətn və tünd səthlər — soyuq slate
        ink: {
          50:  "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
        // Açıq səthlər — ağ / çox açıq bənövşəyi
        paper: {
          DEFAULT: "#ffffff",
          100:     "#f5f3ff",
          200:     "#ede9fe",
        },
        // ƏSAS vurğu — indigo
        moss: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
        },
        // İkinci vurğu — bənövşəyi
        clay: {
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          400: "#a855f7",
          500: "#9333ea",
        },
        // Təhlükə / imtina — rose
        rust: {
          400: "#fb7185",
          500: "#e11d48",
          600: "#be123c",
        },
        // Xəbərdarlıq — amber
        sun: {
          400: "#fbbf24",
          500: "#f59e0b",
        },
      },
      backgroundImage: {
        // Results App fonu
        "brand-gradient":
          "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
      },
      fontFamily: {
        display: ['"IBM Plex Serif"', "Georgia", "serif"],
        sans:    ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono:    ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        // Şüşə (glass) görünüşü üçün yumşaq, indigo çalarlı kölgələr
        card: "inset 0 1px 0 rgba(255,255,255,0.5), 0 10px 30px -12px rgba(79,70,229,0.35)",
        deep: "0 24px 60px -20px rgba(79,70,229,0.55)",
      },
      borderRadius: {
        soft: "14px",
      },
    },
  },
  plugins: [],
};