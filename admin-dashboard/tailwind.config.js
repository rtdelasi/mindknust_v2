/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0eeff',
          100: '#eae8ff',
          200: '#d7d4ff',
          300: '#bab3ff',
          400: '#9487ff',
          500: '#6c53f8',
          600: '#5b3fe0',
          700: '#4d2fc4',
          800: '#4027a4',
          900: '#352187',
          950: '#1d1154',
        }
      }
    },
  },
  plugins: [],
}
