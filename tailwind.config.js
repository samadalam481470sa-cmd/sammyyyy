/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        newport: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fc',
          400: '#36abf8',
          500: '#0c8fe9',
          600: '#0171c7',
          700: '#025aa1',
          800: '#064c84',
          900: '#0a406e',
          950: '#072849',
        },
        pe: {
          navy: '#0b192c',
          slate: '#1e293b',
          gold: '#d97706',
          emerald: '#059669',
        }
      },
    },
  },
  plugins: [],
}
