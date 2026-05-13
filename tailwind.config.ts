import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fef9ee",
          100: "#fdf0d4",
          200: "#f9dda8",
          300: "#f5c46c",
          400: "#f0a42e",
          500: "#ec8c0f",
          600: "#dc7009",
          700: "#b6530a",
          800: "#924110",
          900: "#773710",
          950: "#411a06",
        },
      },
    },
  },
  plugins: [],
};

export default config;
