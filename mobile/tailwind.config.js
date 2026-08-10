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
      // Cuatro radios y no más: tarjeta, control, control pequeño y píldora.
      // Antes convivían 14, 12, 10, 9 y 7 px y la interfaz se veía descosida.
      borderRadius: { card: "18px", lg2: "14px", ctl: "10px", sheet: "14px", pill: "999px" },
      // Escala tipográfica de Apple (HIG). Cada tamaño lleva SU interlineado y
      // tracking: usarlos juntos es lo que da el aspecto de app de sistema.
      fontSize: {
        largeTitle: ["34px", { lineHeight: "41px", letterSpacing: "0.37px" }],
        title1: ["28px", { lineHeight: "34px", letterSpacing: "0.36px" }],
        title2: ["22px", { lineHeight: "28px", letterSpacing: "0.35px" }],
        title3: ["20px", { lineHeight: "25px", letterSpacing: "0.38px" }],
        headline: ["17px", { lineHeight: "22px", letterSpacing: "-0.41px" }],
        body: ["17px", { lineHeight: "22px", letterSpacing: "-0.41px" }],
        callout: ["16px", { lineHeight: "21px", letterSpacing: "-0.32px" }],
        subhead: ["15px", { lineHeight: "20px", letterSpacing: "-0.24px" }],
        footnote: ["13px", { lineHeight: "18px", letterSpacing: "-0.08px" }],
        caption1: ["12px", { lineHeight: "16px" }],
        caption2: ["11px", { lineHeight: "13px", letterSpacing: "0.07px" }],
      },
    },
  },
  plugins: [],
};
