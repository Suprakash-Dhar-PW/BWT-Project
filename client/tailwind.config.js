/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Outfit', 'sans-serif'],
      },
      backgroundImage: {
        'saas-gradient': 'linear-gradient(135deg, #1d4ed8 0%, #312e81 100%)',
      }
    },
  },
  plugins: [],
}
