// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      keyframes: {
        "slide-out-main": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-250px)" },
        },
        "slide-in-main": {
          from: { transform: "translateX(-250px)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "slide-out-main": "slide-out-main 0.5s ease-in-out forwards",
        "slide-in-main": "slide-in-main 0.3s ease-in-out forwards",
      },
    },
  },
  plugins: [],
};
