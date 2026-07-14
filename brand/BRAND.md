# Sequel Brand Guidelines

Based on the **official SequelOrtho Brand Guide v1.0 (Sept 2024)**. This is the shared brand baseline for every Sequel application (Project Hub, Acquisition Hub, and future tools). Machine-readable values live in [`tokens.css`](./tokens.css) (framework-free CSS custom properties) and [`theme.css`](./theme.css) (the Tailwind v4 layer with dark mode, RYG status tokens, focus ring, and print rules).

## Color palette

| Role | Name | Hex | RGB | Usage |
|------|------|-----|-----|-------|
| Primary | Light Blue | `#009DDD` | 0, 157, 221 | h2, CTAs, links |
| Primary hover | Light Blue 600 | `#0083BD` | — | hover (derived) |
| Primary pressed | Light Blue 700 | `#006A9C` | — | pressed (derived) |
| Dark | Dark Blue (navy) | `#0F1263` | 15, 18, 99 | headlines on light, dark accent, deck headers |
| Dark muted | Dark Blue muted | `#232A7A` | — | secondary dark surfaces (derived) |
| Accent | Lime (chartreuse) | `#CAD400` | 202, 212, 0 | highlights; in-app it specifically means **assign / hand-off** actions |
| Accent dark | Lime dark | `#9AA300` | — | derived |
| Text | Grey | `#707372` | 112, 115, 114 | body / secondary text |
| Surface | Surface tint | `#F8F8F8` | — | light backgrounds |
| Error | Error red | `#E51919` | — | errors / danger |
| Deck critical | Maroon | `#8C1D2D` | — | emphasized/critical table rows in decks (never reuse the navy header fill) |

Dark-mode values for every token live in `theme.css` — statuses are lightened/desaturated rather than reused (the "dark yellow problem"). Don't invent per-app dark values.

## Typography

- **Primary typeface:** Montserrat (weights 400, 500, 600, 700) — UI *and* generated documents/decks.
- **Monospace:** Geist Mono (code, tabular data).
- In Next.js, load both via `next/font/google` with CSS variables `--font-montserrat` / `--font-geist-mono`; `theme.css` references those variables.

## Logo

Assets in [`assets/`](./assets):

| File | Use on |
|------|--------|
| `logo-navy.png` | Light backgrounds (default). Navy (`#0F1263`) monochrome treatment. |
| `logo-white.png` | Brand-blue / dark backgrounds. |
| `banner.png` | Marketing / social header (blue gradient lockup). |

The artwork is the official lockup (the "Sequel / ORTHO" wordmark + ripple mark). The white logo is keyed off the banner's blue gradient to transparency; the navy monochrome is the same alpha mask filled with brand Dark Blue — an accepted treatment for light surfaces.

**Usage:** white variant on brand-blue/dark surfaces; navy (default) on light backgrounds. In a theme-aware UI, render both and toggle with the `dark:` variant so the logo stays legible in dark mode.

> If a product ships under its own name, swap the logo files in the app and keep the palette/typography tokens as the shared baseline.
