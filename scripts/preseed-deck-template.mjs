// One-time (idempotent) pre-seed for the approved SequelOrtho brand-deck template.
//
// The approved PowerPoint template ships its title/subtitle placeholders EMPTY
// — the visible prompt text lives in the layout, so the slide-level placeholder
// has no `<a:t>` run. pptx-automizer's `modify.setText` replaces the text of the
// first `<a:t>` it finds; with none present it silently no-ops. This script seeds
// each title/subtitle placeholder (by `<p:ph>` type ctrTitle/subTitle/title) with
// a single minimal run so `setText` has an anchor to populate. Body placeholders
// are deliberately LEFT EMPTY — the deck builder overlays data tables there via
// `slide.generate()`, and a seeded-but-unwritten body would render a stray glyph.
//
// The run carries a minimal `<a:rPr lang="en-US"/>` so it inherits the brand's
// font/colour/size from the layout + master. Safe to re-run: a placeholder that
// already has an `<a:t>` is skipped.
//
// Usage:
//   node preseed-deck-template.mjs <in> [out]   # out defaults to in (in-place)

import { readFile, writeFile } from "node:fs/promises";
import JSZip from "jszip";

const SEED_PH_TYPES = new Set(["ctrTitle", "subTitle", "title"]);
const SEED_RUN = '<a:r><a:rPr lang="en-US"/><a:t>x</a:t></a:r>';

// Replace the empty paragraph (`<a:p><a:endParaRPr .../></a:p>` or `<a:p/>`)
// inside a target shape's txBody with a paragraph carrying a real run.
function seedTxBody(sp) {
  if (/<a:t>/.test(sp)) return { sp, seeded: false }; // already has text
  // Prefer to keep the existing endParaRPr by inserting the run before it.
  if (/<a:p><a:endParaRPr[^>]*\/><\/a:p>/.test(sp)) {
    return {
      sp: sp.replace(
        /<a:p>(<a:endParaRPr[^>]*\/>)<\/a:p>/,
        `<a:p>${SEED_RUN}$1</a:p>`,
      ),
      seeded: true,
    };
  }
  if (/<a:p\/>/.test(sp)) {
    return { sp: sp.replace(/<a:p\/>/, `<a:p>${SEED_RUN}</a:p>`), seeded: true };
  }
  // Fallback: empty <a:p></a:p>
  if (/<a:p><\/a:p>/.test(sp)) {
    return { sp: sp.replace(/<a:p><\/a:p>/, `<a:p>${SEED_RUN}</a:p>`), seeded: true };
  }
  return { sp, seeded: false };
}

function seedSlideXml(xml) {
  let count = 0;
  const out = xml.replace(/<p:sp>[\s\S]*?<\/p:sp>/g, (sp) => {
    const phType = sp.match(/<p:ph\s+type="([^"]*)"/);
    if (!phType || !SEED_PH_TYPES.has(phType[1])) return sp;
    const { sp: seeded, seeded: didSeed } = seedTxBody(sp);
    if (didSeed) count += 1;
    return seeded;
  });
  return { out, count };
}

export async function preseedTemplate(inputBuffer) {
  const zip = await JSZip.loadAsync(inputBuffer);
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort();
  let total = 0;
  const perSlide = [];
  for (const name of slideNames) {
    const xml = await zip.file(name).async("string");
    const { out, count } = seedSlideXml(xml);
    if (count > 0) zip.file(name, out);
    total += count;
    perSlide.push({ name, count });
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return { buffer, total, perSlide };
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const inPath = process.argv[2];
  if (!inPath) {
    console.error("Usage: node preseed-deck-template.mjs <template.pptx> [out.pptx]");
    process.exit(1);
  }
  const outPath = process.argv[3] || inPath;
  const input = await readFile(inPath);
  const { buffer, total, perSlide } = await preseedTemplate(input);
  await writeFile(outPath, buffer);
  console.log(`Pre-seeded ${total} placeholder(s):`);
  for (const s of perSlide) console.log(`  ${s.name}: ${s.count}`);
  console.log(`Wrote ${outPath} (${buffer.length} bytes)`);
}
