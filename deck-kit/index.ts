// Sequel deck kit — the brand-generic mechanics under every generated deck.
// Chart primitives are native pptxgenjs shapes (editable, portable, no images);
// pptx-slim keeps generated decks under platform response limits. The branded
// template engine (buildBrandedDeck + the approved .pptx template) is still
// per-app pending Phase B decoupling — see README.md.
export { FONT } from "./fonts";
export * from "./deck-charts";
export { slimPresentationZip } from "./pptx-slim";
