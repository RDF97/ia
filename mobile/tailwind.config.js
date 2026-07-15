const v = (name) => `rgb(var(${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Semánticos (cambian claro/oscuro vía variables CSS)
        bg: v("--bg"),
        card: v("--card"),
        elevated: v("--elevated"),
        label: v("--label"),
        secondary: v("--secondary"),
        tertiary: v("--tertiary"),
        separator: v("--separator"),
        accent: v("--accent"),
        // Estáticos
        green: "#34C759",
        orange: "#FF9500",
        red: "#FF3B30",
        blue: "#007AFF",
        teal: "#5AC8FA",
        purple: "#AF52DE",
        pink: "#FF2D55",
      },
      borderRadius: { card: "18px", lg2: "14px", pill: "999px" },
    },
  },
  plugins: [],
};
