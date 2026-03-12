import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./frontend/src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    extend: {},
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
