/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        hanalei_regular: ["Hanalei"],
        nanum: ["Nanum Pen Script"],
      },
      colors: {
        brand: {
          orange: "#f2641d",
          orange_light: "#f88650",
          orange_soft: "#f9a577",
          orange_hover: "#f9a577",
          orange_bg: "#fbc3a5",
          main: "#f5f6fa",
          sub1: "#8b1b33",
          sub2: "#a32745",
          sub: "#c1445e",
        },
      },
    },
  },
  plugins: [],
};
