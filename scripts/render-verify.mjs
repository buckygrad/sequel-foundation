#!/usr/bin/env node
// Render-verify a generated .pptx — the mandatory pre-commit check for any
// deck-exporter change (see docs/DECK-CRAFT.md, "Render-verify workflow").
//
// Steps: (1) EOCD integrity check — a truncated download/generation is a zip
// missing its end-of-central-directory record and PowerPoint will demand a
// "repair"; (2) LibreOffice headless render to PDF; (3) pdftoppm to per-slide
// PNGs you can eyeball (or pixel-diff). Remember: LibreOffice is the LENIENT
// viewer — PowerPoint renders Montserrat wider and ignores nothing; a clean
// LibreOffice render is necessary, not sufficient. Always render a STRESS
// fixture (long names, many rows, empty states), not a happy-path deck.
//
// Usage: node render-verify.mjs <deck.pptx> [outdir]
//   outdir defaults to <deck-dir>/render-verify/
//
// Requires LibreOffice (soffice) and poppler (pdftoppm) — `brew install
// --cask libreoffice` / `brew install poppler`.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SOFFICE_CANDIDATES = [
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
  "soffice",
];

function findSoffice() {
  for (const c of SOFFICE_CANDIDATES) {
    try {
      execFileSync(c, ["--version"], { stdio: "pipe" });
      return c;
    } catch {
      /* next */
    }
  }
  throw new Error("LibreOffice (soffice) not found — install it or add it to PATH.");
}

const deckPath = process.argv[2];
if (!deckPath || !existsSync(deckPath)) {
  console.error("Usage: node render-verify.mjs <deck.pptx> [outdir]");
  process.exit(1);
}
const outDir = process.argv[3] ?? path.join(path.dirname(deckPath), "render-verify");
mkdirSync(outDir, { recursive: true });

// 1. Zip integrity: the EOCD signature PK\x05\x06 must appear in the last 1KB.
const buf = readFileSync(deckPath);
const tail = buf.subarray(Math.max(0, buf.length - 1024));
if (!tail.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06]))) {
  console.error(`FAIL: ${deckPath} has no zip EOCD record — file is truncated/corrupt.`);
  process.exit(1);
}
console.log(`ok: zip EOCD present (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);

// 2. LibreOffice → PDF.
const soffice = findSoffice();
execFileSync(soffice, ["--headless", "--convert-to", "pdf", "--outdir", outDir, deckPath], {
  stdio: "pipe",
});
const pdfPath = path.join(outDir, `${path.basename(deckPath, path.extname(deckPath))}.pdf`);
if (!existsSync(pdfPath)) {
  console.error("FAIL: LibreOffice produced no PDF.");
  process.exit(1);
}
console.log(`ok: rendered ${pdfPath} (${(statSync(pdfPath).size / 1024).toFixed(0)} KB)`);

// 3. PDF → per-slide PNGs. NB pdftoppm names single-digit "<prefix>-1.png"
// when <10 pages and zero-padded "<prefix>-01.png" when ≥10.
const prefix = path.join(outDir, "slide");
execFileSync("pdftoppm", ["-png", "-r", "95", pdfPath, prefix], { stdio: "pipe" });
const pngs = readdirSync(outDir).filter((f) => f.startsWith("slide") && f.endsWith(".png"));
console.log(`ok: ${pngs.length} slide PNG(s) in ${outDir} — inspect them:`);
for (const f of pngs.sort()) console.log(`  ${path.join(outDir, f)}`);
