/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./constants/**/*.{js,jsx,ts,tsx}",
    "./hooks/**/*.{js,jsx,ts,tsx}",
    "./services/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        app: {
          text: "#11181C",
          "text-dark": "#ECEDEE",
          bg: "#ffffff",
          "bg-dark": "#151718",
          tint: "#0a7ea4",
          icon: "#687076",
          "icon-dark": "#9BA1A6",
        },
      },
    },
  },
  plugins: [],
};
