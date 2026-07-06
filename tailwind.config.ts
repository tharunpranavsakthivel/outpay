import type { Config } from "tailwindcss";

/**
 * Tailwind config wired to the Outpay Design System's CSS custom properties.
 * The properties themselves (--background, --card, --border, --primary, ...)
 * are OKLCH-derived semantic tokens — see src/styles/tokens/*.css, copied
 * verbatim from the design system's token files. Do NOT hand-pick new hex
 * values; every color in this file is a var() passthrough so the design
 * system's light/dark theming keeps working unchanged.
 *
 * Tailwind v4 note: v4's native config mechanism is CSS-based (`@theme` in
 * globals.css), but v4 still loads a JS/TS config like this one for
 * backward compatibility via an `@config "./tailwind.config.ts";` directive
 * in your CSS entry point (already added in src/styles/globals.css). You
 * do not need to hand-convert this file to `@theme` syntax — just make sure
 * the `@config` path in globals.css correctly points here.
 */
export default {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/views/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        popover: "var(--popover)",
        "popover-foreground": "var(--popover-foreground)",
        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",
        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",
        tertiary: "var(--tertiary)",
        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        destructive: "var(--destructive)",
        "destructive-foreground": "var(--destructive-foreground)",
        warning: "var(--warning)",
        "warning-foreground": "var(--warning-foreground)",
        info: "var(--info)",
        "info-foreground": "var(--info-foreground)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        "border-stronger": "var(--border-stronger)",
        "border-control": "var(--border-control)",
        "border-destructive": "var(--border-destructive)",
        "border-warning": "var(--border-warning)",
        "border-info": "var(--border-info)",
        "border-brand": "var(--border-brand)",
        input: "var(--input)",
        ring: "var(--ring)",
        "foreground-light": "var(--foreground-light)",
        "foreground-lighter": "var(--foreground-lighter)",
        "foreground-muted": "var(--foreground-muted)",
        "background-surface-75": "var(--background-surface-75)",
        "background-surface-200": "var(--background-surface-200)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"Source Code Pro"', "ui-monospace", "monospace"],
      },
      fontSize: {
        xs: "var(--text-xs)",
        sm: "var(--text-sm)",
        base: "var(--text-base)",
        lg: "var(--text-lg)",
        xl: "var(--text-xl)",
        "2xl": "var(--text-2xl)",
        "3xl": "var(--text-3xl)",
        "4xl": "var(--text-4xl)",
        "5xl": "var(--text-5xl)",
      },
      fontWeight: {
        body: "450",
        medium: "500",
        semibold: "600",
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        panel: "var(--radius-panel)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        "focus-ring": "var(--focus-ring)",
      },
      spacing: {
        xs: "var(--spacing-xs)",
        sm: "var(--spacing-sm)",
        md: "var(--spacing-md)",
        lg: "var(--spacing-lg)",
        xl: "var(--spacing-xl)",
      },
      maxWidth: {
        content: "var(--content-width-max)",
      },
    },
  },
  plugins: [],
} satisfies Config;
