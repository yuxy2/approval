/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: {
            light: '#F5E8E8',
            mid: '#C0392B',
            DEFAULT: '#8B1A1A',
          },
          gray: {
            light: '#F5F5F5',
            DEFAULT: '#4A4A4A',
          }
        }
      },
    },
  },
  plugins: [],
};
