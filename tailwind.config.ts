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
        toyota: {
          red: "#EB0A1E",
          dark: "#1a0000",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
