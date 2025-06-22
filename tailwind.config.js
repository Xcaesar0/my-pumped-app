/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontSize: {
        '10xl': '10rem',
      },
      screens: {
        'xs': '475px',
      }
    },
  },
  plugins: [],
};