// IMPORTANT (RTL/LTR): components in this project should prefer Tailwind's
// logical-property utilities (ms-/me-/ps-/pe-/start-/end-/text-start/text-end)
// instead of physical left/right utilities (ml-/mr-/pl-/pr-/left-/right-).
// Logical utilities automatically flip direction based on the `dir` attribute
// set in src/app/[locale]/layout.tsx, so the SAME markup works correctly for
// both Arabic (RTL) and French (LTR) without any conditional classes.
/** @type {import("tailwindcss").Config} */
const config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Bound to CSS variables set from ClubSettings (see globals.css),
        // so club branding (primary/secondary color) is editable at runtime
        // from Dashboard > Settings > Appearance without a rebuild.
        club: {
          primary: "rgb(var(--club-primary-rgb) / <alpha-value>)",
          secondary: "rgb(var(--club-secondary-rgb) / <alpha-value>)"
        },
        primary: {
          DEFAULT: "rgb(var(--club-primary-rgb) / <alpha-value>)",
          foreground: "#ffffff"
        },
        border: "hsl(var(--border) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        "muted-foreground": "hsl(var(--muted-foreground) / <alpha-value>)",
        card: "hsl(var(--card) / <alpha-value>)",
        destructive: "hsl(var(--destructive) / <alpha-value>)"
      },
      boxShadow: {
        "2xs": "0 1px 2px 0 rgba(0, 0, 0, 0.04)",
        "xs": "0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)"
      },
      borderRadius: {
        DEFAULT: "0.625rem"
      },
      fontFamily: {
        sans: ["var(--font-plus-jakarta)", "var(--font-ibm-plex-arabic)", "var(--font-cairo)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-plus-jakarta)", "var(--font-cairo)", "sans-serif"],
        arabic: ["var(--font-ibm-plex-arabic)", "var(--font-cairo)", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
