/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tukole v2 palette — teal primary (trust), coral accent (action)
        // Inspired by the Brizah brand reference + traditional Ugandan textile palettes
        teal: {
          50:  "#F0F8F8",
          100: "#D9EBEB",
          200: "#A8D2D2",
          300: "#6BB3B3",
          400: "#3E9595",
          500: "#0E6B6B",
          600: "#0C5757",
          700: "#0A4444",
          800: "#083333",
          900: "#062525",
        },
        coral: {
          50:  "#FFF4EE",
          100: "#FFE3D2",
          200: "#FFC09C",
          300: "#FF9C66",
          400: "#FF7B3A",
          500: "#EF6018",
          600: "#C84B0A",
          700: "#9A3806",
        },
        sand: {
          50:  "#FBF6F0",
          100: "#F5ECE0",
          200: "#EBDFCC",
          300: "#D9C4A4",
        },
        ink: {
          500: "#374044",
          700: "#1F2629",
          900: "#0D1214",
        },
        // Semantic aliases used throughout the UI
        ledger: {
          credit: "#0E6B6B",   // teal — money in
          debit:  "#C84B0A",   // coral — money out
          paper:  "#FBF6F0",
          rule:   "#EBDFCC",
        },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans:    ["Inter", "system-ui", "sans-serif"],
        mono:    ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft:   "0 1px 2px rgba(13, 18, 20, 0.04), 0 4px 12px rgba(13, 18, 20, 0.05)",
        lift:   "0 4px 8px rgba(13, 18, 20, 0.06), 0 16px 32px rgba(13, 18, 20, 0.08)",
        ledger: "inset 0 -1px 0 rgba(235, 223, 204, 0.6)",
        ring:   "0 0 0 4px rgba(14, 107, 107, 0.15)",
      },
      borderRadius: {
        card: "14px",
        chip: "999px",
      },
      keyframes: {
        pulse_dot: {
          "0%, 100%": { opacity: "0.3", transform: "scale(0.95)" },
          "50%":      { opacity: "1",   transform: "scale(1)" },
        },
        slide_up: {
          "0%":   { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulse_dot: "pulse_dot 1.6s ease-in-out infinite",
        slide_up:  "slide_up 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
