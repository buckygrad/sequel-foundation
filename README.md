# @sequel/foundation

The shared foundation for Sequel Ortho applications: brand tokens and theme, the design-system UI primitives, LLM plumbing, the deck kit, guide-build machinery, and repo hygiene tooling — extracted from **Project Hub** (`project-insights`) and the **Acquisition Hub** (`Sequel_Ortho`), which previously kept these in sync by hand ("the twin registry").

Two documents carry the accumulated know-how; read them before building anything user-facing or deck-shaped:

- **[docs/DESIGN-CONVENTIONS.md](docs/DESIGN-CONVENTIONS.md)** — the UX rules that make Sequel apps feel like one family.
- **[docs/DECK-CRAFT.md](docs/DECK-CRAFT.md)** — everything learned generating board-quality pptx/docx/xlsx at runtime.

## Contents

| Subpath | What it is |
|---|---|
| `@sequel/foundation/brand/tokens.css` | Framework-free brand custom properties (Brand Guide v1.0) |
| `@sequel/foundation/brand/theme.css` | Tailwind v4 layer: dark mode variant, tokens incl. dark values, RYG, blue-ramp remap, focus ring, print rules |
| `@sequel/foundation/brand/assets/*` | Logo PNGs (navy / white / banner) — see `brand/BRAND.md` |
| `@sequel/foundation/theme` | Theme model: modes, `resolveTheme`, `themeInitScript(storageKey)` |
| `@sequel/foundation/theme/ThemeToggle` | The Light / Dark / Browser header toggle (client component) |
| `@sequel/foundation/ui` | Button (incl. the accent hand-off variant), Callout, Field, StatusBadges, SaveStateIndicator, Toast + viewport/store, ShowMore, Breadcrumbs, ExportBar |
| `@sequel/foundation/llm` | `getClient`, `modelFor`/`withModelFallback` (task-class model config), `llmErrorEvent`, `streamJob`/`consumeLlmStream` |
| `@sequel/foundation/deck-kit` | Native-shape chart primitives (`deck-charts`), `slimPresentationZip` (dedupe + prune), brand `FONT` |
| `@sequel/foundation/docs-kit/guide-contents` | Bookmarked-outline Contents machinery for generated .docx guides |
| `@sequel/foundation/scripts/*` | `clean-icloud-dups.sh`, `preseed-deck-template.mjs`, `render-verify.mjs` |

## Consuming from a Next.js app

1. **Install** (git dependency; tag releases and pin):

   ```jsonc
   // package.json
   "dependencies": {
     "@sequel/foundation": "github:buckygrad/sequel-foundation#v0.1.0"
   }
   ```

   The package ships TypeScript/TSX source, so add to `next.config.ts`:

   ```ts
   transpilePackages: ["@sequel/foundation"],
   ```

2. **Styles** — in `app/globals.css`:

   ```css
   @import "tailwindcss";
   @import "@sequel/foundation/brand/theme.css";
   /* Tailwind v4 doesn't scan node_modules by default; scan the package so
      its component classes are generated: */
   @source "../node_modules/@sequel/foundation";
   ```

3. **Layout** — fonts, theme init, toggle:

   ```tsx
   import { Montserrat, Geist_Mono } from "next/font/google";
   import { themeInitScript } from "@sequel/foundation/theme";
   import { ThemeToggle } from "@sequel/foundation/theme/ThemeToggle";

   const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" });
   const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
   const THEME_KEY = "myapp.theme"; // per-app; existing hubs keep pi.theme / hub.theme

   // in <body>, first element:
   <script dangerouslySetInnerHTML={{ __html: themeInitScript(THEME_KEY) }} />
   // in the header:
   <ThemeToggle storageKey={THEME_KEY} />
   ```

4. **LLM env vars** (all optional overrides): `ANTHROPIC_API_KEY`, `LLM_MODEL_PROSE` (default `claude-sonnet-5`), `LLM_MODEL_PRESENTATION` (default `claude-fable-5`), `LLM_MODEL_FALLBACK` (default `claude-opus-4-8`).

5. **Peer deps**: install what the subpaths you use need — `jszip`/`pptx-automizer` for deck-kit, `@anthropic-ai/sdk` for llm, `docx` for docs-kit.

## Twin-retirement map (Phase C)

When the two existing hubs adopt this package, these local copies are deleted and imports repointed; until then the hand-sync rule still applies to anything below.

| App file (both hubs unless noted) | Replaced by |
|---|---|
| `lib/theme.ts`, `components/ThemeToggle.tsx` | `theme`, `theme/ThemeToggle` (pass the app's storage key) |
| brand token blocks in `app/globals.css` | `brand/theme.css` import |
| `lib/llm/{models,client,http,stream,stream-client}.ts` | `llm` |
| `lib/exporters/pptx-slim.ts` (Sequel_Ortho) / prune logic inside `brand-deck.ts` | `deck-kit` (`slimPresentationZip`) |
| `lib/exporters/deck-charts.ts` (project-insights) | `deck-kit` |
| `scripts/lib/guide-contents.mjs` (Sequel_Ortho) | `docs-kit/guide-contents` |
| `scripts/clean-icloud-dups.sh`, `scripts/preseed-deck-template.mjs` | `scripts/*` |
| `components/ui/*` (Sequel_Ortho), `components/{Button,Callout,ShowMore,Breadcrumbs,ExportBar}.tsx` (project-insights) | `ui` — **note the merges below** |

**Merge decisions (canonical vs. the old copies):**

- **Button** — Project Hub's variant vocabulary (`primary` blue / `secondary` navy / `accent` chartreuse hand-off / `outline` / `outlineBrand` / `danger`) + Acquisition Hub's `ghost`, polymorphic `href` → `<Link>`, and `busy`/`busyLabel`. `buttonClasses` takes an options object. *Acquisition Hub's old `secondary` (neutral border) maps to `outline`.*
- **Callout** — Acquisition Hub's canonical (icon + optional title, `role` derived from tone). Project Hub's `role` prop is dropped; tone set is identical.
- **StatusBadges** — `ApprovedBadge` now takes `approvedAt` (+ optional `label`) instead of the playbook domain type.
- **theme** — `THEME_STORAGE_KEY` constant became `themeInitScript(storageKey)` + a `storageKey` prop; behavior otherwise identical.

## Not here yet (Phase B)

- **`brand-deck.ts` template engine** (`buildBrandedDeck`, `buildEmptyRoot`, `pruneUnusedLayoutsAndMedia`, table/status primitives) — needs the SEQ/ON/FVO slide-index map and header fills parameterized into a brand-template descriptor, and the two hubs' drift reconciled. The approved template `.pptx` binaries also live with the apps until then.
- **docx brand helper** — Project Hub's docx exporters each re-declare `NAVY`/`BLUE`/`FONT`; consolidate when extracting.
- **xlsx style helper** — decide brand-navy vs. the Acquisition Hub's current zinc header fill, then extract.
- **VCP engine** — clean single-file twin, but its tie-out tests and constants are per-app; extract with care.
- **Nav shell / tile-parity registry pattern** — reusable pattern, app-specific registries; extract the shell + parity-test helper.
- **App starter template** (Phase D) — a `create-sequel-app` template repo wiring all of the above.

## Development

```bash
npm install
npm test          # vitest unit suite
npm run typecheck
```

Versioning: tag releases (`v0.x.y`); consumers pin the tag in their git dependency. Changing anything in `ui/`, `theme/`, or `brand/` is a visual change in every consumer — check both hubs before releasing.
