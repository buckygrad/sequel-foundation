// Sequel deck kit — the brand-generic mechanics under every generated deck.
// Chart primitives are native pptxgenjs shapes (editable, portable, no images);
// the brand-deck engine renders onto the app's approved template (the app
// supplies a BrandDeckEngineConfig with its template path + slide map); and
// pptx-slim keeps generated decks under platform response limits.
export { FONT } from "./fonts";
export * from "./deck-charts";
export * from "./brand-deck";
export { slimPresentationZip } from "./pptx-slim";
