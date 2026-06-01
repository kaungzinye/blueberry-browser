/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/renderer/**/*.{js,ts,jsx,tsx,html}"],
  // Telemetry color classes are built by interpolation in telemetryVisuals.ts,
  // so Tailwind's content scan can't see them — safelist the base classes.
  safelist: [
    {
      pattern:
        /(text|bg|ring|border|stroke|fill)-tm-(intent|action|observation|decision|tool|write|complete|blocker)/,
    },
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          foreground: "rgb(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "rgb(var(--secondary) / <alpha-value>)",
          foreground: "rgb(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--destructive) / <alpha-value>)",
          foreground: "rgb(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "rgb(var(--popover) / <alpha-value>)",
          foreground: "rgb(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          foreground: "rgb(var(--card-foreground) / <alpha-value>)",
        },

        // Garden design tokens (see src/renderer/garden/src/styles/tokens.css).
        surface: {
          0: "rgb(var(--surface-0) / <alpha-value>)",
          1: "rgb(var(--surface-1) / <alpha-value>)",
          2: "rgb(var(--surface-2) / <alpha-value>)",
          3: "rgb(var(--surface-3) / <alpha-value>)",
        },
        garden: {
          base: "rgb(var(--garden-base) / <alpha-value>)",
          mid: "rgb(var(--garden-mid) / <alpha-value>)",
          core: "rgb(var(--garden-core) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          muted: "rgb(var(--ink-muted) / <alpha-value>)",
          faint: "rgb(var(--ink-faint) / <alpha-value>)",
        },
        line: "rgb(var(--line) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          strong: "rgb(var(--accent-strong) / <alpha-value>)",
          foreground: "rgb(var(--accent-foreground) / <alpha-value>)",
        },
        tm: {
          intent: "rgb(var(--tm-intent) / <alpha-value>)",
          action: "rgb(var(--tm-action) / <alpha-value>)",
          observation: "rgb(var(--tm-observation) / <alpha-value>)",
          decision: "rgb(var(--tm-decision) / <alpha-value>)",
          tool: "rgb(var(--tm-tool) / <alpha-value>)",
          write: "rgb(var(--tm-write) / <alpha-value>)",
          complete: "rgb(var(--tm-complete) / <alpha-value>)",
          blocker: "rgb(var(--tm-blocker) / <alpha-value>)",
        },
      },
      fontFamily: {
        // "Usual browser fonts" — system stacks only, no bundled typefaces.
        sans: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        display: [
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          '"SF Mono"',
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 0.1rem)",
        sm: "calc(var(--radius) - 0.4rem)",
      },
      fontSize: {
        "2xs": ["0.625rem", "0.75rem"],
      },
      spacing: {
        4.5: "1.125rem",
      },
      boxShadow: {
        // Restrained, single-layer depth for chrome over the blue field.
        panel: "0 12px 32px -16px rgba(0,0,0,0.55)",
        lift: "0 4px 16px -8px rgba(0,0,0,0.5)",
        sheet: "0 -16px 48px -24px rgba(0,0,0,0.6)",
      },
      animation: {
        "spring-scale": "spring-scale 0.2s ease-in-out forwards",
        "star-spin": "star-spin 3s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out forwards",
      },
      keyframes: {
        "spring-scale": {
          "0%": { transform: "scale(0.95)" },
          "50%": { transform: "scale(1.02)" },
          "100%": { transform: "scale(1)" },
        },
        "star-spin": {
          "0%, 50%": { transform: "rotate(0deg)" },
          "60%": { transform: "rotate(-20deg)" },
          "65%": { transform: "rotate(-15deg)" },
          "67%": { transform: "rotate(-20deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
