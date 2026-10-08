/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../extension/src/panel/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pine: "#1b3a2f",
        clay: "#d9763a",
        cream: "#f6f1e8",
        ink: "#14221c",
        sand: "#e8c9a8",
      },
      fontFamily: {
        serif: ['"Iowan Old Style"', "Palatino", "Georgia", "serif"],
      },
    },
  },
};
