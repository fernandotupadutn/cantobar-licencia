/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          400: '#F59E0B',
          500: '#E06D00',
          600: '#D97706',
          700: '#B45309',
        },
      },
    },
  },
  plugins: [],
};
