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
        },
      },
    },
  },
  plugins: [],
};
