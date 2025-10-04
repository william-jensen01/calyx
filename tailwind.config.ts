import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Greens
        cream: "hsl(var(--clr-cream))",
        mint: "hsl(var(--clr-mint))",
        sage: "hsl(var(--clr-sage))",
        leaf: "hsl(var(--clr-leaf))",
        moss: "hsl(var(--clr-moss))",
        forest: "hsl(var(--clr-forest))",
        pine: "hsl(var(--clr-pine))",

        // Browns
        sand: "hsl(var(--clr-sand))",
        wheat: "hsl(var(--clr-wheat))",
        amber: "hsl(var(--clr-amber))",
        clay: "hsl(var(--clr-clay))",
        bark: "hsl(var(--clr-bark))",
        walnut: "hsl(var(--clr-walnut))",
        soil: "hsl(var(--clr-soil))",

        "hero-accent": "hsl(var(--hero-accent))",

        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary), <alpha-value>)",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary), <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        "geist-sans": ["var(--font-geist-sans)"],
        bricolage: ["var(--font-bricolage-grotesque)"],
        main: ["var(--font-bricolage-grotesque)"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
