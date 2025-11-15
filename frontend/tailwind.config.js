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
