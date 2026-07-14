# Sequel Design Conventions

The UX rules that make Project Hub and the Acquisition Hub feel like one product family. Every new Sequel application adopts these from day one. Rules marked **(code)** are enforced or embodied by a module in this repo; the rest are conventions to carry into the app.

## 1. Brand & theming

- **One token mechanism** (code: `brand/tokens.css`, `brand/theme.css`). All color flows through CSS custom properties; Tailwind utilities reference tokens (`bg-brand`, `text-brand-navy`), never raw hexes. Tailwind's default `blue-*` ramp is remapped to brand blues so third-party-ish code adopts the brand automatically.
- **Dark mode is an attribute, not a media query** (code: `theme/theme.ts`, `ThemeToggle`). The resolved theme is stamped on `<html data-theme>` by a pre-hydration script (no flash), a three-state Light / Dark / Browser toggle persists in localStorage, and Tailwind's `dark:` variant is re-keyed to the attribute. Per-app localStorage key (`pi.theme`, `hub.theme`, …) so apps don't fight; the auto mode is stored as `"system"` and **labeled "Browser"** (it reads `prefers-color-scheme`, which is the browser's setting).
- **The dark yellow problem**: dark mode gets its own lightened/desaturated status values (see `theme.css`), never the light palette on a dark ground. Don't invent per-app dark values.
- **Montserrat everywhere** — UI, docx, xlsx, pptx. Monospace is Geist Mono. Load via `next/font/google` with `--font-montserrat` / `--font-geist-mono` variables.

## 2. Color semantics

- **Chartreuse accent = hand-off.** The lime accent (`#CAD400`) is reserved for assign / hand-off / delegate actions (code: `Button` variant `accent`). Views and passive links stay arrow-less and non-accent. Accent buttons take dark ink (zinc-900), never navy — navy washes out on lime, in both themes.
- **Icon + label, never color alone.** Every status indicator pairs a shape/icon with text: the ApprovedBadge check-circle + "Approved · date" (code: `ui/StatusBadges.tsx`), RYG dots next to status words, the dumbbell chart's hollow-start/filled-end dots. This is an accessibility floor, not a style choice.
- **RYG stoplight vocabulary** (code: tokens in `theme.css`). Green / Yellow / Red / None, with separate `-text` variants for colored text. Thresholds are computed by shared pure helpers (see §4), and the same tokens drive UI chips and deck dot-cells.
- **Maroon (`#8C1D2D`) for critical rows in decks** — an emphasized table row must not reuse the navy header fill or it reads as a second header.

## 3. Interaction & state

- **Explicit sign-off for commitment actions; auto-advance only trivial transitions.** Anything that implies acknowledgement, approval, or an auditable decision (completing a gate, approving a phase, adopting a baseline) is an explicit user action — the apps are the record a steering committee reads. Auto-advancing "you typed something → in progress" is fine and appreciated.
- **Save-state chip idiom** (code: `ui/SaveState.tsx`): `Saving… → Unsaved changes → Saved · 2:14 PM`. Toasts confirm saves; error toasts linger longer than confirmations (code: `ui/toast/`).
- **Locked areas render as non-links** — `role="link" aria-disabled` with the reason printed on the tile ("Complete due diligence to unlock"), never a dead `<a href>` and never a hidden tile (GOV.UK "cannot start yet" + NN/g). Server routes redirect locked URLs; the PATCH/API layer enforces the same rule. **Keep all enforcement layers in agreement** — UI affordance, server redirect, API validation.
- **Progressive disclosure for long lists** (code: `ui/ShowMore.tsx`): "Show N more / Show all (X) / Show fewer" with a live "Showing X of Y" count. No unbounded lists, no silent truncation.
- **Working-ahead warnings, not locks, for soft dependencies** — an amber banner ("Phase 1 is not yet completed…") when a user works in a later phase, reserved locks for hard gates.

## 4. Architecture principles

- **Shared pure helpers when UI and an exporter compute the same thing.** If a filter/sort/score appears in a `.tsx` view and a deck/workbook exporter, extract it to a plain function that takes the domain object, and unit-test it. The preview and the download must call the same function — execs must read what the analyst just reviewed.
- **Domain knowledge lives in content/templates, generators assemble.** Editable-by-non-engineers content (KPI libraries, phase templates, question catalogs, model constants) stays in data modules; logic modules stay generic.
- **LLM model selection is configuration** (code: `llm/models.ts`). Call sites declare a task class (`prose` | `presentation`) and go through `modelFor` + `withModelFallback`; adopting a new model is an env-var change. Never hardcode a model id at a call site.
- **Cache-stable system prompts.** The large static framework prompt is the cache target (`cache_control: ephemeral`); all per-request data goes in the user message. Never interpolate timestamps/UUIDs/names into the system prompt.
- **Typed exceptions, never string-matching** (code: `llm/http.ts`). Map SDK error classes to `{status, error}`.
- **Streaming beats platform timeouts** (code: `llm/stream.ts` + `stream-client.ts`). Any LLM-backed route streams SSE with heartbeats (`streamJob`), and the browser collapses it back to one awaited value (`consumeLlmStream`). Jobs that exceed the streamed-function cap (~60s on Netlify) go to a background function returning **202 + poll**.
- **Registry-driven surfaces.** Exports, admin areas, and home tiles are data (a registry array), and the UI renders the registry. Adding a capability = appending a descriptor, not hand-editing three components.

## 5. Navigation & structure

- **Tile ↔ menu parity.** Every hub tile appears in that section's nav dropdown, added in the same PR, both rendered from one shared registry — locked by a parity unit test so a hand-edited menu can't drift.
- **Breadcrumbs on nested routes** (code: `ui/Breadcrumbs.tsx`); the last crumb is the current page, unlinked, `aria-current`.
- **Print is a feature** (code: print block in `theme.css` + `ui/ExportBar.tsx`): every read-only view saves cleanly to PDF; chrome and export buttons carry `data-no-print`.

## 6. Accessibility floor

- Visible brand focus ring on keyboard focus (`:focus-visible`, in `theme.css`), never removed.
- Minimum tap-target heights on all buttons (code: `ui/Button.tsx` sizes).
- `aria-live` on dynamic counts; `role="alert"` on danger callouts, `role="status"` elsewhere (code: `ui/Callout.tsx`).
- WCAG ≥ 4.5:1 for text chips (the emerald badge pairing is pre-checked).

## 7. Writing & labels

- **Title-case for buttons, tiles, and nav items**; sentence case for body and hints.
- **The arrow (→) means hand-off** — pair it with accent actions; plain views stay arrow-less.
- Say what unlocks a locked thing ("Complete due diligence to unlock"), not just that it's locked.
- Error messages name the likely cause and the fix ("the configured API key lacks permission for this model — check ANTHROPIC_API_KEY").

## 8. Verification habits

- **Verify every render state a change touches** — pre-gate and post-gate, with and without an active record, empty/error/loading — not just the state you developed in.
- **Every user-facing PR regenerates the app's guide** in the same PR (docs-kit convention): the guide is a committed artifact and drifts silently otherwise. Validate by extracting the docx text and checking new wording present, stale wording absent.
- Deck/exporter changes follow the render-verify workflow in [DECK-CRAFT.md](./DECK-CRAFT.md).
