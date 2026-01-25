import type { Config } from "tailwindcss";

// Avatar frame animation keyframes are defined below in the theme.extend.keyframes section

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        'cairo': ['Cairo', 'Cairo Fallback', 'sans-serif'],
        'tajawal': ['Tajawal', 'sans-serif'],
        'almarai': ['Almarai', 'sans-serif'],
        'amiri': ['Amiri', 'serif'],
        'scheherazade': ['Scheherazade New', 'serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        "background-2": "hsl(var(--background-2))",
        foreground: "hsl(var(--foreground))",
        whatsapp: "hsl(var(--whatsapp))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "pulse-slow": {
          "0%, 100%": {
            opacity: "1",
            boxShadow: "0 0 20px hsl(var(--primary) / 0.4)",
          },
          "50%": {
            opacity: "0.95",
            boxShadow: "0 0 30px hsl(var(--primary) / 0.6)",
          },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
"avatar-frame-glow": {
          "0%, 100%": {
            transform: "scale(1)",
            opacity: "0.4",
          },
          "50%": {
            transform: "scale(1.15)",
            opacity: "0.7",
          },
        },
        "avatar-frame-pulse": {
          "0%, 100%": {
            filter: "drop-shadow(0 0 4px hsl(var(--primary) / 0.5)) brightness(1)",
            transform: "scale(1)",
          },
          "50%": {
            filter: "drop-shadow(0 0 12px hsl(var(--primary) / 0.8)) brightness(1.1)",
            transform: "scale(1.03)",
          },
        },
        "avatar-frame-rotate": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "avatar-frame-shimmer": {
          "0%": { 
            backgroundPosition: "-200% 0",
            filter: "drop-shadow(0 0 3px hsl(var(--primary) / 0.4))",
          },
          "100%": { 
            backgroundPosition: "200% 0",
            filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.6))",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-slow": "pulse-slow 2s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        "avatar-frame-glow": "avatar-frame-glow 3s ease-in-out infinite",
        "avatar-frame-pulse": "avatar-frame-pulse 2.5s ease-in-out infinite",
        "avatar-frame-rotate": "avatar-frame-rotate 20s linear infinite",
        "avatar-frame-shimmer": "avatar-frame-shimmer 3s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
