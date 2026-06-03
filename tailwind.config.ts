import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        yota: {
          green: "#2D6A4F",
          light: "#40916C",
          dark: "#1B4332",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
