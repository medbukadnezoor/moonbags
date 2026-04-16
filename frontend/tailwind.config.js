export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
        display: ["'Space Grotesk'", "ui-sans-serif", "system-ui"],
      },
      colors: {
        // MoonBags — Pepe on the Moon palette
        border: "hsl(228 12% 18%)",
        input: "hsl(228 12% 18%)",
        ring: "hsl(89 53% 44%)",
        background: "hsl(232 17% 6%)",
        foreground: "hsl(48 19% 92%)",
        primary: { DEFAULT: "hsl(89 53% 44%)", foreground: "hsl(232 17% 6%)" },
        secondary: { DEFAULT: "hsl(228 12% 12%)", foreground: "hsl(48 19% 92%)" },
        muted: { DEFAULT: "hsl(228 12% 12%)", foreground: "hsl(225 5% 64%)" },
        accent: { DEFAULT: "hsl(228 12% 16%)", foreground: "hsl(48 19% 92%)" },
        destructive: { DEFAULT: "hsl(350 100% 62%)", foreground: "hsl(0 0% 98%)" },
        card: { DEFAULT: "hsl(232 16% 10%)", foreground: "hsl(48 19% 92%)" },
        popover: { DEFAULT: "hsl(232 16% 10%)", foreground: "hsl(48 19% 92%)" },
        gain: "hsl(82 60% 56%)",
        loss: "hsl(350 100% 68%)",
        cyan: "hsl(89 53% 50%)",          // legacy name preserved — now Pepe Green
        pepe: "hsl(89 53% 44%)",
        earth: "hsl(202 80% 54%)",
        coral: "hsl(20 65% 56%)",
        moon: "hsl(48 5% 73%)",
        // Stitch-derived surface scale + variants
        "surface": "hsl(232 17% 8%)",
        "surface-container-lowest": "hsl(235 16% 5%)",
        "surface-container-low": "hsl(232 12% 11%)",
        "surface-container": "hsl(232 12% 14%)",
        "surface-container-high": "hsl(232 9% 17%)",
        "surface-container-highest": "hsl(228 9% 21%)",
        "on-surface-variant": "hsl(73 14% 75%)",
        "outline-variant": "hsl(82 8% 26%)",
        "primary-container": "hsl(89 53% 44%)",
      },
      borderRadius: { lg: "4px", md: "4px", sm: "2px" },
    },
  },
  plugins: [],
};
