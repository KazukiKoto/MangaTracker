/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#05131a",
        glow: "#02a3a4",
        ember: "#ff8a44"
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Chivo"', "sans-serif"]
      },
      borderRadius: {
        xl: "1.5rem"
      },
      boxShadow: {
        floating: "0 25px 60px rgba(5, 18, 26, 0.45)"
      }
    }
  },
  plugins: []
};
