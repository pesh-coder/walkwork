/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tukole brand palette
        // The story: warm earth (Uganda red soil), forest (vegetation),
        // cream (paper/ledger), graphite (ink).
        cream: {
          50: "#FBF8F3",
          100: "#F5F0E6",
          200: "#EBE4D2",
          300: "#DCD0B5",
        },
        terracotta: {
          400: "#D97757",
          500: "#C8623E",
          600: "#A84E2E",
          700: "#85391E",
        },
        forest: {
          400: "#5F7A5C",
          500: "#3F5D3D",
          600: "#2D4628",
          700: "#1E2F1B",
          900: "#0D1A0C",
        },
        ink: {
          500: "#2A2520",
          700: "#1A1612",
          900: "#0E0C09",
        },
        ledger: {
          credit: "#3F5D3D",
          debit: "#A84E2E",
          paper: "#FBF8F3",
          rule: "#DCD0B5",
        },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(20, 16, 10, 0.04), 0 4px 12px rgba(20, 16, 10, 0.05)",
        lift: "0 4px 8px rgba(20, 16, 10, 0.06), 0 16px 32px rgba(20, 16, 10, 0.08)",
        ledger: "inset 0 -1px 0 rgba(220, 208, 181, 0.6)",
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
