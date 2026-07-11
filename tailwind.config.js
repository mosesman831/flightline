/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "SF Pro Display",
          "SF Pro",
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        mono: ["SF Mono", "SFMono-Regular", "ui-monospace", "monospace"],
      },
      colors: {
        ios: {
          blue: "#007AFF",
          green: "#34C759",
          orange: "#FF9500",
          red: "#FF3B30",
          gray: "#8E8E93",
          bg: "#F2F2F7",
          card: "#FFFFFF",
          darkbg: "#000000",
          darkcard: "#1C1C1E",
        },
      },
      borderRadius: {
        ios: "1.125rem",
      },
      boxShadow: {
        soft: "0 4px 24px rgba(0,0,0,0.06)",
        ios: "0 8px 32px rgba(0,0,0,0.08)",
      },
      transitionTimingFunction: {
        "apple-spring": "cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
};
