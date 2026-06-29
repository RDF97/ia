/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Tokens del design system del mockup Homie
        accent: "#1F4D52",
        "accent-dark": "#3FA5AD",
        blue: "#007AFF",
        green: "#34C759",
        orange: "#FF9500",
        red: "#FF3B30",
        yellow: "#FFCC00",
        teal: "#5AC8FA",
        purple: "#AF52DE",
        pink: "#FF2D55",
        "bg-app": "#F2F2F7",
      },
      borderRadius: {
        card: "18px",
        lg2: "14px",
        pill: "999px",
      },
    },
  },
  plugins: [],
};
