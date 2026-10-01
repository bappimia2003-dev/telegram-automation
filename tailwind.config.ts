import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(0 0% 4%)",
        foreground: "hsl(0 0% 98%)",
        card: "hsl(0 0% 7%)",
        "card-foreground": "hsl(0 0% 98%)",
        popover: "hsl(0 0% 7%)",
        "popover-foreground": "hsl(0 0% 98%)",
        primary: "hsl(217 91% 60%)",
        "primary-foreground": "hsl(0 0% 100%)",
        secondary: "hsl(0 0% 12%)",
        "secondary-foreground": "hsl(0 0% 98%)",
        muted: "hsl(0 0% 15%)",
        "muted-foreground": "hsl(0 0% 64%)",
        accent: "hsl(217 91% 60%)",
        "accent-foreground": "hsl(0 0% 100%)",
        destructive: "hsl(0 84% 60%)",
        "destructive-foreground": "hsl(0 0% 100%)",
        border: "hsl(0 0% 15%)",
        input: "hsl(0 0% 15%)",
        ring: "hsl(217 91% 60%)",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
