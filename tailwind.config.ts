import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        brand: ["var(--font-brand)", "system-ui", "sans-serif"],
        tactical: ["var(--font-tactical)", "SFMono-Regular", "monospace"],
      },
    },
  },
};

export default config;
