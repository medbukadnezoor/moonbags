---
version: "0.1"
name: MoonBags
description: Space-themed meme coin auto-trading dashboard with a dark, high-contrast terminal aesthetic

colors:
  # Brand
  primary: "#72ac35"
  on-primary: "#0d0d12"
  primary-container: "#273b12"
  on-primary-container: "#cde7b1"

  secondary: "#2ca3e8"
  on-secondary: "#0d0d12"
  secondary-container: "#082e45"
  on-secondary-container: "#a3d7f5"

  # Semantic
  gain: "#a1d24b"
  on-gain: "#0d0d12"
  loss: "#ff5c77"
  on-loss: "#0d0d12"
  error: "#ff3d5e"
  on-error: "#0d0d12"
  error-container: "#4d000d"
  on-error-container: "#ff99aa"

  # Surfaces
  background: "#0d0d12"
  on-background: "#eeede7"
  surface: "#111218"
  on-surface: "#eeede7"
  surface-container-lowest: "#0b0b0f"
  surface-container-low: "#191a1f"
  surface-container: "#1f2128"
  surface-container-high: "#27282f"
  surface-container-highest: "#31333a"
  on-surface-variant: "#9fa1a8"

  # Utility
  outline: "#282b33"
  outline-variant: "#363945"

typography:
  display:
    fontFamily: "Space Grotesk"
    fontSize: "120px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.05em"

  headline-lg:
    fontFamily: "Space Grotesk"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "36px"
    letterSpacing: "-0.02em"

  headline-md:
    fontFamily: "Space Grotesk"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "24px"
    letterSpacing: "-0.01em"

  title-lg:
    fontFamily: "Space Grotesk"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: "20px"
    letterSpacing: "0.05em"

  body-lg:
    fontFamily: "JetBrains Mono"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"

  body-md:
    fontFamily: "JetBrains Mono"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "18px"

  label-md:
    fontFamily: "JetBrains Mono"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: "16px"
    letterSpacing: "0.1em"

  label-sm:
    fontFamily: "JetBrains Mono"
    fontSize: "9px"
    fontWeight: 700
    lineHeight: "14px"
    letterSpacing: "0.15em"

spacing:
  base: "8px"
  xs: "4px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
  gutter: "16px"

rounded:
  sm: "2px"
  DEFAULT: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.sm}"

  button-primary-hover:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"

  button-destructive:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-error}"
    typography: "{typography.label-md}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.sm}"

  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.sm}"

  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.sm}"

  card:
    backgroundColor: "{colors.surface-container-low}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"

  badge-default:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"

  badge-gain:
    backgroundColor: "{colors.gain}"
    textColor: "{colors.on-gain}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"

  badge-loss:
    backgroundColor: "{colors.loss}"
    textColor: "{colors.on-loss}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"

  badge-info:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.on-secondary-container}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"

  status-pill-live:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"

  status-pill-dry-run:
    backgroundColor: "{colors.secondary-container}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"

  status-pill-disconnected:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.error}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"

  position-card:
    backgroundColor: "{colors.surface-container-low}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
    height: "120px"

  config-pill:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "{spacing.xs}"

  top-bar:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-background}"
    height: "56px"

  bottom-strip:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface-variant}"
    height: "48px"

  card-outlined:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"

  alert-error:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.on-error-container}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"

  divider:
    backgroundColor: "{colors.outline}"
    textColor: "{colors.on-surface-variant}"

  divider-subtle:
    backgroundColor: "{colors.outline-variant}"
    textColor: "{colors.on-surface}"

  button-ghost:
    backgroundColor: "{colors.surface-container-highest}"
    textColor: "{colors.on-surface}"
    typography: "{typography.label-md}"
    rounded: "{rounded.DEFAULT}"
    padding: "{spacing.sm}"

  hero-section:
    backgroundColor: "{colors.background}"
    textColor: "{colors.on-background}"

  card-outlined-subtle:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
---

## Overview

MoonBags is a real-time meme coin auto-trading dashboard for Solana. The visual identity leans hard into the space/moon crypto aesthetic — think mission control meets Pepe meme energy. The target user is a degenerate trader who wants to monitor automated positions at a glance, not a fintech normie who wants clean pastels.

The design should feel like a Bloomberg terminal that got abducted by frogs. High contrast, monospace data, a star field background, and Pepe green as the dominant accent. Every UI decision reinforces two things: **this is serious trading software** and **we are going to the moon**.

## Colors

The palette is built around three semantic anchors: Pepe green (`hsl(89 53% 44%)`) for profit and primary actions, Coral red (`hsl(350 100% 62%)`) for loss and risk, and Earth blue (`hsl(202 80% 54%)`) for neutral/dry-run states. This mirrors the trader's mental model — green good, red bad, blue cautious.

Surfaces use a deep navy-black system (`hsl(232 17% 6%)` base) that creates depth through elevation rather than shadows. Dark mode is not an option — it's the only mode. The star field and radial glows only work on dark.

The gain/loss semantic pair (`gain` vs `loss`) is intentionally brighter than the primary/error pair. In data-dense tables, you need instant color recognition from 3 feet away.

All `on-*` pairings are designed to exceed WCAG AA contrast at 4.5:1+ against their backgrounds.

## Typography

Two typefaces, no exceptions:

**Space Grotesk** handles all display and heading text. Its slightly quirky geometry fits the meme coin personality without being unreadable. Used uppercase with wide tracking for section labels to create a terminal-readout feeling.

**JetBrains Mono** handles all data — prices, timestamps, status text, labels, buttons. Monospace is mandatory for trading UIs because tabular-nums alignment lets users scan columns of numbers without their eyes jumping around. The `tabular-nums` font feature should always be active for price and percentage displays.

The display size (120px) is intentionally oversized for the hero PnL number. The whole point of the dashboard is to see your unrealized gains from across the room. Smaller on mobile (56px) but still dominant.

## Layout

Mobile-first single column that expands to 3-column on desktop. Fixed top bar (56px) and fixed bottom config strip (48px) create a persistent chrome — the user always knows the bot status and key config without scrolling.

8px base grid. Cards get 16px internal padding. The positions list is the primary real estate; everything else is secondary chrome.

## Elevation & Depth

No box shadows on dark backgrounds — they vanish. Depth is created through:
1. **Surface elevation tints**: `surface-container-lowest` → `surface-container-highest` (5 steps)
2. **Backdrop blur + glass**: Top bar, bottom strip, and hero section use `backdrop-blur-xl` with semi-transparent backgrounds
3. **Glow halos**: The hero section has a subtle Pepe green radial gradient glow. The page background has two large ambient glows (earth blue bottom, pepe green top-right)

The star field is fixed (doesn't scroll), reinforcing the space metaphor and adding visual interest to the background without distracting from the data.

## Shapes

Sharp corners across the board — `2px` to `8px` max. This is intentional. Rounded corners feel soft and consumer-grade; sharp corners feel technical and serious. The exception is status pills and badges, which use `full` rounding (`9999px`) to visually distinguish them from cards and containers.

Position cards use a 4px left accent strip (colored by PnL tone) rather than a colored border. This gives immediate visual categorization while keeping the card surface uniform.

## Components

**Buttons** always use `font-mono`, uppercase, and wide letter-spacing (`tracking-widest`). They should look like terminal commands, not web app buttons.

**Position cards** are fixed height (120px) with a left-side accent strip. The strip color encodes win/neutral/loss at a glance before the user reads any numbers. PnL percentage is displayed in `label-md` mono, right-aligned, color-coded. The mini sparkline (132×48) lives at the right edge.

**Alert feed items** use a 2px left border (not a strip) for their tone encoding. The border is thinner because alert items are tighter (no fixed height) and the left-side treatment should be visually lighter than position cards.

**Config pills** in the bottom strip use a `label/value` pair pattern: a 9px gray mono label above a 10px bold mono value. The value takes a tone color (pepe/earth/coral/muted) based on what it represents — e.g., a very short sell timer gets coral, a healthy one gets pepe.

Hover states use opacity-90 for primary buttons and a container color shift for others. Transitions at 150ms feel snappy; 500ms is used only for the drawdown health bar fill animation.

Touch targets meet 44px minimum even when elements look smaller — padding compensates visually.

## Do's and Don'ts

**Do** use `tabular-nums` on every price and percentage value.

**Do** use the gain/loss semantic colors for PnL displays, not primary/error. They're tuned for the darker tint variants used in data tables.

**Don't** use rounded corners larger than `lg` (8px) on any container. Only pills and badges get `full` rounding.

**Don't** add shadows to dark-surface components — they don't render visibly and add no depth.

**Don't** use Space Grotesk for data values. It's not monospace and numbers will jitter as they update.

**Don't** use more than three accent colors in a single card. Pepe green + one status tone is the maximum. Four colors means the user can't parse it.
