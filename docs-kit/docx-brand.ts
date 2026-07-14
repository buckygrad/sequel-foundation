// Brand constants for generated Word documents (the `docx` library). Every
// Sequel docx exporter previously re-declared these five per file — this is
// the one shared source. Hex strings are docx-style (no leading #).
//
// Usage: table-header shading + title runs take NAVY, links/accents take BLUE,
// the accent rule under a title is LIME→NAVY (mirror of the deck accentBar),
// secondary text takes GREY, and every run sets font: FONT (Montserrat is the
// brand typeface in documents too — see brand/BRAND.md).

export { FONT } from "../deck-kit/fonts";

export const NAVY = "0F1263"; // Dark Blue — headings, table-header shading
export const BLUE = "009DDD"; // Light Blue — links, accents, h2
export const LIME = "CAD400"; // accent rule / highlight
export const GREY = "707372"; // secondary text
export const SURFACE = "F8F8F8"; // tinted panel shading
export const DANGER = "E51919"; // error / critical text
// Critical table-row shading — maroon, never the navy header fill (a critical
// row must not read as a second header; same rule as decks).
export const CRITICAL = "8C1D2D";
