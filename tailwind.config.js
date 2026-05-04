/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "system-ui"]
      },
      colors: {
        ink: "#0a0a0a",
        paper: "#fafaf7",
        accent: "#ff3d00",
        muted: "#6b6b6b"
      }
    }
  },
  plugins: []
};
