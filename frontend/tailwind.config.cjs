/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        secondary: "hsl(var(--secondary))",
        "secondary-foreground": "hsl(var(--secondary-foreground))",
        destructive: "hsl(var(--destructive))",
        "destructive-foreground": "hsl(var(--destructive-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        accent: "hsl(var(--accent))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))"
      },
      borderRadius: {
        xl: "1.25rem",
        lg: "1rem",
        md: "0.75rem",
        sm: "0.5rem"
      },
      boxShadow: {
        soft: "0 10px 30px -20px rgba(16, 24, 40, 0.35)"
      },
      fontFamily: {
        display: ["'SF Pro Display'", "'Segoe UI'", "sans-serif"],
        body: ["'SF Pro Text'", "'Segoe UI'", "sans-serif"]
      }
    }
  },
  plugins: []
};



