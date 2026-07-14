import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { Automizer, modify } from "pptx-automizer";
import type { IPptxGenJSSlide } from "pptx-automizer";
import { FONT } from "./fonts";
import { slimPresentationZip } from "./pptx-slim";

// Branded-deck engine — the merged canonical of the two hubs' brand-deck.ts
// (formerly hand-synced twins). Every generated PowerPoint renders ONTO the
// app's approved brand template instead of being drawn from scratch, so each
// deck carries the real Montserrat master, brand logo, header band, and footer.
//
// The engine is brand-generic: the app supplies a BrandDeckEngineConfig naming
// its template file and the slide→layout map per brand (Project Hub: SEQ/ON/FVO
// multi-brand; Acquisition Hub: SEQ only). Template slide numbers must be
// verified against the committed template, and title/subtitle placeholders must
// be pre-seeded once with scripts/preseed-deck-template.mjs — automizer's
// modify.setText silently no-ops on an empty placeholder.
//
// How a deck builds:
//   1. buildEmptyRoot() strips the template's own slides + clears the slide list
//      so we start from zero slides but keep all layouts/masters/media/theme.
//   2. Each requested slide clones the brand's cover / divider / content
//      template slide, sets its title (+subtitle) via modify.setText, and
//      overlays real data tables / stat boxes onto the brand's content area via
//      slide.generate() (pptxgenjs interop). Tables land inside the brand
//      frame, never bulleted text.
//   3. dedupeShapeIds() repairs the duplicate <p:cNvPr id> collisions the
//      interop introduces (PowerPoint's main "repair prompt" trigger), then
//      slimPresentationZip() dedupes byte-identical media and prunes every
//      layout/media/chart part the assembled deck doesn't reference, and the
//      zip is packed with real DEFLATE — three defenses that keep downloads
//      under streamed-function response limits (see docs/DECK-CRAFT.md §5).

// Per-brand slide→layout map + labels. Slide numbers are 1-based positions in
// the template; placeholder element names differ between brands' layouts.
export type BrandSlideMap = {
  key: string;
  label: string;
  cover: number;
  divider: number;
  content: number;
  coverTitle: string;
  coverSubtitle: string;
  dividerTitle: string;
  contentTitle: string;
  // Table-header fill (brand navy/dark) used by content tables.
  headerFill: string;
};

export type BrandDeckEngineConfig<K extends string> = {
  // Either a template path (read once and cached) or a custom loader.
  templatePath?: string;
  loadTemplate?: () => Promise<Buffer>;
  brands: Record<K, BrandSlideMap>;
  defaultBrand: K;
};

export type BrandDeckSlide =
  | { kind: "cover"; title: string; subtitle?: string }
  | { kind: "divider"; title: string }
  | { kind: "content"; title: string; draw?: (g: IPptxGenJSSlide) => void };

export type BrandDeckSpec<K extends string = string> = {
  brand?: K; // defaults to the engine's defaultBrand
  author?: string;
  title?: string;
  slides: BrandDeckSlide[];
};

export type BrandDeckEngine<K extends string> = {
  buildBrandedDeck: (spec: BrandDeckSpec<K>) => Promise<Buffer>;
  headerFill: (brand?: K) => string;
  brandLabel: (brand?: K) => string;
  brands: Record<K, BrandSlideMap>;
};

export function createBrandDeckEngine<K extends string>(
  cfg: BrandDeckEngineConfig<K>,
): BrandDeckEngine<K> {
  if (!cfg.templatePath && !cfg.loadTemplate) {
    throw new Error("BrandDeckEngineConfig needs templatePath or loadTemplate.");
  }
  let cachedTemplate: Buffer | null = null;
  const loadTemplate = async (): Promise<Buffer> => {
    if (!cachedTemplate) {
      cachedTemplate = cfg.loadTemplate
        ? await cfg.loadTemplate()
        : await readFile(cfg.templatePath!);
    }
    return cachedTemplate;
  };
  const brandCfg = (brand?: K): BrandSlideMap => cfg.brands[brand ?? cfg.defaultBrand];

  async function buildBrandedDeck(spec: BrandDeckSpec<K>): Promise<Buffer> {
    const b = brandCfg(spec.brand);
    const template = await loadTemplate();
    const emptyRoot = await buildEmptyRoot(template);

    const automizer = new Automizer({});
    const pres = automizer.loadRoot(emptyRoot).load(template, "tpl");

    for (const slide of spec.slides) {
      if (slide.kind === "cover") {
        pres.addSlide("tpl", b.cover, (s) => {
          s.modifyElement(b.coverTitle, modify.setText(slide.title));
          // Always write the subtitle (the placeholder was seeded with a glyph;
          // an unset cover would otherwise show the seed text).
          s.modifyElement(b.coverSubtitle, modify.setText(slide.subtitle ?? ""));
        });
      } else if (slide.kind === "divider") {
        pres.addSlide("tpl", b.divider, (s) => {
          s.modifyElement(b.dividerTitle, modify.setText(slide.title));
        });
      } else {
        pres.addSlide("tpl", b.content, (s) => {
          s.modifyElement(b.contentTitle, modify.setText(slide.title));
          if (slide.draw) s.generate((g) => slide.draw!(g));
        });
      }
    }

    const jszip = await pres.getJSZip();
    // Repair duplicate shape ids introduced by the table/stat-box overlays.
    for (const name of Object.keys(jszip.files)) {
      if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) {
        const xml = await jszip.file(name)!.async("string");
        jszip.file(name, dedupeShapeIds(xml));
      }
    }
    // Dedupe media + prune every part the assembled deck doesn't reference
    // (unused brand layouts and their multi-MB photo backgrounds especially).
    // Supersedes the hubs' pruneUnusedLayoutsAndMedia — same layout/media prune
    // plus byte-identical media collapse and chart/diagram/notes pruning.
    await slimPresentationZip(jszip);
    // Pack with real DEFLATE — JSZip defaults to STORE, which leaves every
    // slide XML uncompressed. Level 6: level 9 costs several extra
    // lambda-seconds for ~1% smaller output.
    return (await jszip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })) as Buffer;
  }

  return {
    buildBrandedDeck,
    headerFill: (brand?: K) => brandCfg(brand).headerFill,
    brandLabel: (brand?: K) => brandCfg(brand).label,
    brands: cfg.brands,
  };
}

// Strip every slide from the template zip and clear the slide list, leaving an
// otherwise-intact root presentation (layouts/masters/media/theme preserved) to
// clone branded slides into.
export async function buildEmptyRoot(buffer: Buffer): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  for (const name of Object.keys(zip.files)) {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) zip.remove(name);
    if (/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(name)) zip.remove(name);
  }
  let pres = await zip.file("ppt/presentation.xml")!.async("string");
  pres = pres.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, "<p:sldIdLst/>");
  zip.file("ppt/presentation.xml", pres);
  let rels = await zip.file("ppt/_rels/presentation.xml.rels")!.async("string");
  rels = rels.replace(/<Relationship[^>]*Type="[^"]*\/slide"[^>]*\/>/g, "");
  zip.file("ppt/_rels/presentation.xml.rels", rels);
  // Drop the removed slides' content-type overrides too — otherwise the rebuilt
  // deck declares each slide part twice (a duplicate Override is one of the
  // defects PowerPoint flags with a "repair" prompt).
  let ct = await zip.file("[Content_Types].xml")!.async("string");
  ct = ct.replace(/<Override PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g, "");
  zip.file("[Content_Types].xml", ct);
  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}

// Re-number every shape's non-visual id so they are unique within each slide.
// pptx-automizer's generate() (pptxgenjs interop) numbers its injected shapes
// from scratch, colliding with the cloned placeholders already on the slide —
// duplicate <p:cNvPr id> is the main trigger of PowerPoint's repair prompt.
// cNvPr ids aren't cross-referenced in these decks (no animations/links by id),
// so a flat sequential renumber per slide is safe.
export function dedupeShapeIds(xml: string): string {
  let next = 1;
  return xml.replace(/<p:cNvPr id="\d+"/g, () => `<p:cNvPr id="${next++}"`);
}

// ---- shared draw primitives (operate on the pptxgenjs interop slide) ----

// Brand content area, identical across the approved content layouts (inches).
// (The Acquisition Hub previously used bottom 6.6; 6.7 is the Project Hub
// value and the canonical one — content still clears the footer band.)
export const CONTENT = { x: 0.92, y: 1.75, w: 11.5, bottom: 6.7 };
// Y for small "+N more" / attribution notes — above the footer band so they
// never sit under the brand logo. (Same Y as the takeaway band; use one or the
// other on a slide, not both.)
export const FOOTNOTE_Y = 6.25;

export const NAVY = "0F1263"; // SequelOrtho Dark Blue
export const GREY = "707372"; // SequelOrtho Grey
const WHITE = "FFFFFF";
const LIGHT = "F8F8F8";
const RYG_FILL: Record<string, string> = {
  Green: "16A34A",
  Yellow: "EAB308",
  Red: "DC2626",
};

export type Cell = { text: string; options?: Record<string, unknown> };

export const th = (
  text: string,
  fill = NAVY,
  fontSize = 11,
  align: "left" | "center" | "right" = "left",
): Cell => ({
  text,
  options: { fill: { color: fill }, color: WHITE, bold: true, fontFace: FONT, fontSize, valign: "middle", align },
});
export const td = (text: string, opts: Record<string, unknown> = {}): Cell => ({
  text,
  options: { fontFace: FONT, fontSize: 10.5, color: "27272A", valign: "middle", ...opts },
});
// A red/yellow/green status pill: first letter on the RYG fill, en-dash if absent.
export const rygTd = (v: string | null): Cell =>
  v
    ? { text: v[0], options: { fill: { color: RYG_FILL[v] ?? GREY }, color: WHITE, bold: true, align: "center", valign: "middle", fontFace: FONT, fontSize: 12 } }
    : { text: "–", options: { align: "center", valign: "middle", color: "A1A1AA", fontFace: FONT, fontSize: 11 } };

export const money = (n: number) =>
  n === 0 ? "—" : `$${Math.round(n).toLocaleString("en-US")}`;
export const pct = (f: number | null) => (f == null ? "–" : `${Math.round(f * 100)}%`);
export const trunc = (s: string | null, n: number) =>
  !s ? "" : s.length <= n ? s : `${s.slice(0, n - 1)}…`;

// Scale a colW array so it exactly fills the brand content width, preserving the
// caller's column proportions.
function fitColW(colW: number[], w = CONTENT.w): number[] {
  const sum = colW.reduce((a, b) => a + b, 0);
  if (sum <= 0) return colW;
  const k = w / sum;
  return colW.map((c) => Math.round(c * k * 1000) / 1000);
}

const ZEBRA = "FAFAFB";

// Shade alternating body rows (every other data row) for scannability — but
// never overwrite a cell that already carries its own fill (RYG cells, total
// rows). Header row (index 0) is left to its navy fill.
function withZebra(rows: Cell[][]): Cell[][] {
  return rows.map((row, i) => {
    if (i === 0 || i % 2 === 1) return row;
    return row.map((cell) =>
      cell.options?.fill
        ? cell
        : { ...cell, options: { ...(cell.options ?? {}), fill: { color: ZEBRA } } },
    );
  });
}

// Place a data table inside the brand content area. Rows are tall and roomy with
// zebra striping; short tables can be vertically centered in the open space so a
// 3-row table doesn't float at the very top of the slide.
//
// Default border style is horizontal rules ONLY — no vertical gridlines.
// Dropping the full cell grid is the single biggest de-"blocking" move (Tufte
// data-ink / NN-g scannable tables): rows read as a continuous list, not a wall
// of boxes. (This is the Project Hub style; the Acquisition Hub's old full grid
// is superseded — pass `border` to override if a specific export needs it.)
export function contentTable(
  g: IPptxGenJSSlide,
  rows: Cell[][],
  opts: {
    x?: number;
    y?: number;
    colW?: number[];
    valign?: "top" | "middle";
    rowH?: number;
    center?: boolean;
    w?: number;
    border?: unknown;
    margin?: number | [number, number, number, number];
  } = {},
) {
  const w = opts.w ?? CONTENT.w;
  const x = opts.x ?? CONTENT.x;
  const colW = opts.colW ? fitColW(opts.colW, w) : undefined;
  const rowH = opts.rowH ?? 0.46;
  const top = opts.y ?? CONTENT.y;
  let y = top;
  if (opts.center) {
    const approxH = rows.length * rowH;
    const avail = CONTENT.bottom - top;
    if (approxH < avail) y = top + (avail - approxH) / 2;
  }
  g.addTable(withZebra(rows) as never, {
    x,
    y,
    w,
    ...(colW ? { colW } : {}),
    rowH,
    fontFace: FONT,
    fontSize: 10.5,
    color: "27272A",
    valign: opts.valign ?? "middle",
    // Generous horizontal padding so cells breathe; numbers/labels aren't crammed.
    margin: opts.margin ?? [3, 10, 3, 10],
    // Order is [top, right, bottom, left]; sides are a hairline rule, left/right none.
    border: (opts.border ?? [
      { type: "solid", color: "EBEBEE", pt: 0.75 },
      { type: "none" },
      { type: "solid", color: "EBEBEE", pt: 0.75 },
      { type: "none" },
    ]) as never,
  });
}

// A board "so what" takeaway band pinned to the bottom of a content slide — the
// one-line synthesis that turns a table of numbers into a conclusion. A tinted
// rounded card with a brand-navy accent bar and a bold "So what" lead-in, so
// every slide answers "and therefore?" without the reader doing the inference.
export function takeaway(g: IPptxGenJSSlide, text: string) {
  const y = 6.25;
  const h = 0.5;
  g.addShape("roundRect", {
    x: CONTENT.x, y, w: CONTENT.w, h, rectRadius: 0.04,
    fill: { color: "EEF1FA" },
  } as never);
  g.addShape("rect", {
    x: CONTENT.x, y, w: 0.09, h, fill: { color: NAVY },
  } as never);
  g.addText(
    [
      { text: "So what", options: { bold: true, color: NAVY } },
      { text: `    ${text}`, options: { color: "3F3F46" } },
    ] as never,
    {
      x: CONTENT.x + 0.26, y, w: CONTENT.w - 0.42, h,
      fontFace: FONT, fontSize: 11.5, valign: "middle",
    } as never,
  );
}

// A single KPI stat box (rounded card with a big value + label). Up to three sit
// side by side at the top of a content slide.
export function statBox(
  g: IPptxGenJSSlide,
  index: 0 | 1 | 2,
  label: string,
  value: string,
  color: string,
  y = CONTENT.y + 0.15,
) {
  const x = CONTENT.x + index * 3.9;
  g.addShape("roundRect", {
    x, y, w: 3.6, h: 1.4, rectRadius: 0.08,
    fill: { color: LIGHT }, line: { color: "E4E4E7", width: 1 },
  } as never);
  g.addText(value, {
    x: x + 0.2, y: y + 0.15, w: 3.2, h: 0.75,
    fontFace: FONT, fontSize: 32, bold: true, color,
  } as never);
  g.addText(label.toUpperCase(), {
    x: x + 0.2, y: y + 0.9, w: 3.2, h: 0.4,
    fontFace: FONT, fontSize: 11, color: GREY, charSpacing: 2,
  } as never);
}

// A short paragraph of body text in the content area (subtitles, empty-state
// notices). Default colour is a readable medium grey, not the faint brand grey.
export function contentNote(g: IPptxGenJSSlide, text: string, y = CONTENT.y, color = "52525B") {
  g.addText(text, {
    x: CONTENT.x, y, w: CONTENT.w, h: 0.5,
    fontFace: FONT, fontSize: 13, color,
  } as never);
}

// Multi-line body text (bulleted lists) in the content area, when a table would
// be over-structured. Each line is one bullet.
export function contentBullets(
  g: IPptxGenJSSlide,
  lines: string[],
  opts: { y?: number; fontSize?: number } = {},
) {
  g.addText(
    lines.map((text) => ({
      text,
      options: { bullet: true, fontFace: FONT, fontSize: opts.fontSize ?? 12, color: "27272A" },
    })) as never,
    {
      x: CONTENT.x,
      y: opts.y ?? CONTENT.y,
      w: CONTENT.w,
      h: CONTENT.bottom - (opts.y ?? CONTENT.y),
      valign: "top",
      paraSpaceAfter: 5,
    } as never,
  );
}

// ---- status / leadership primitives (RYG dots, legend, banners, gauges, cards) ----

// RYG rendered as a coloured dot (status dot per dimension, not a G/Y/R
// letter). Brighter palette than the letter cells so the small glyph reads at
// presentation distance.
export const RYG_DOT: Record<string, string> = { Green: "16A34A", Yellow: "EAB308", Red: "DC2626" };

export const dotCell = (v: string | null): Cell =>
  v
    ? { text: "●", options: { color: RYG_DOT[v] ?? GREY, align: "center", valign: "middle", fontFace: FONT, fontSize: 15 } }
    : { text: "–", options: { color: "A1A1AA", align: "center", valign: "middle", fontFace: FONT, fontSize: 11 } };

// Distinct fill for a critical (red-indicator) table row — a deep maroon, NOT the
// navy header colour, so an emphasized row never reads as a second header.
export const CRITICAL_FILL = "8C1D2D";

// Re-style a built row to flag it as critical — maroon fill, white bold text — but
// keep status dots their RYG colour so they still read on the dark band.
export const emphasizeCells = (cells: Cell[], fill = CRITICAL_FILL, color = WHITE): Cell[] =>
  cells.map((c) =>
    c.text === "●"
      ? { ...c, options: { ...(c.options ?? {}), fill: { color: fill } } }
      : { ...c, options: { ...(c.options ?? {}), fill: { color: fill }, color, bold: true } },
  );

// The On Track / At Risk / Critical key that sits above the status tables.
export function statusKeyLegend(g: IPptxGenJSSlide, y = 1.5, x = CONTENT.x) {
  g.addText(
    [
      { text: "● ", options: { color: RYG_DOT.Green } },
      { text: "On Track     ", options: { color: "52525B" } },
      { text: "● ", options: { color: RYG_DOT.Yellow } },
      { text: "At Risk     ", options: { color: "52525B" } },
      { text: "● ", options: { color: RYG_DOT.Red } },
      { text: "Critical / Action Required", options: { color: "52525B" } },
    ] as never,
    { x, y, w: CONTENT.w, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, valign: "middle" } as never,
  );
}

// A red alert strip — the "⚠ approval needed…" callout above a table.
export function alertBanner(g: IPptxGenJSSlide, text: string, y: number) {
  const h = 0.5;
  g.addShape("roundRect", {
    x: CONTENT.x, y, w: CONTENT.w, h, rectRadius: 0.03,
    fill: { color: "FEF2F2" }, line: { color: "FCA5A5", width: 1 },
  } as never);
  g.addShape("rect", { x: CONTENT.x, y, w: 0.09, h, fill: { color: "DC2626" } } as never);
  g.addText(
    [
      { text: "⚠  ", options: { color: "DC2626", bold: true } },
      { text, options: { color: "7F1D1D" } },
    ] as never,
    { x: CONTENT.x + 0.24, y, w: CONTENT.w - 0.42, h, fontFace: FONT, fontSize: 11, valign: "middle", fit: "shrink" } as never,
  );
}

// A horizontal utilization gauge: label, a track with a proportional fill banded
// by load (>100 red / ≥85 amber / else green), and a "128% — OVER" tag. Pools
// with no demand signal render the track empty with a "capacity only" note.
export function gaugeBar(
  g: IPptxGenJSSlide,
  opts: { x: number; y: number; w: number; label: string; utilPct: number | null; sublabel?: string },
) {
  const { x, y, w, label, utilPct, sublabel } = opts;
  g.addText(label, { x, y, w, h: 0.28, fontFace: FONT, fontSize: 12, bold: true, color: NAVY, fit: "shrink" } as never);
  const trackY = y + 0.32;
  const trackH = 0.26;
  const trackW = w * 0.66;
  g.addShape("roundRect", { x, y: trackY, w: trackW, h: trackH, rectRadius: 0.03, fill: { color: "EEEEF1" } } as never);
  if (utilPct != null) {
    const frac = Math.max(0.02, Math.min(1, utilPct / 100));
    const c = utilPct > 100 ? "DC2626" : utilPct >= 85 ? "D97706" : "16A34A";
    g.addShape("roundRect", { x, y: trackY, w: trackW * frac, h: trackH, rectRadius: 0.03, fill: { color: c } } as never);
    const tag = utilPct > 100 ? "OVER" : utilPct >= 85 ? "AT" : "OK";
    g.addText(`${utilPct}% — ${tag}`, {
      x: x + trackW + 0.12, y: trackY - 0.03, w: w - trackW - 0.12, h: trackH + 0.06,
      fontFace: FONT, fontSize: 11, bold: true, color: c, valign: "middle",
    } as never);
  } else {
    g.addText("capacity only", {
      x: x + trackW + 0.12, y: trackY - 0.03, w: w - trackW - 0.12, h: trackH + 0.06,
      fontFace: FONT, fontSize: 10, italic: true, color: GREY, valign: "middle",
    } as never);
  }
  if (sublabel) {
    g.addText(sublabel, { x, y: trackY + trackH + 0.01, w, h: 0.24, fontFace: FONT, fontSize: 9.5, italic: true, color: GREY, fit: "shrink" } as never);
  }
}

// An executive-action card: a tinted box with a severity accent bar, a filled
// HIGH/MED chip next to a bold title, and the body text filling the remaining
// height. No separate deadline footer — fold any date into the body — so
// nothing ever lands on top of the description.
export function riskCard(
  g: IPptxGenJSSlide,
  opts: { x: number; y: number; w: number; h?: number; severity: "High" | "Medium"; title: string; body?: string | null },
) {
  const { x, y, w, severity, title } = opts;
  const h = opts.h ?? 1.2;
  const sev = severity === "High"
    ? { bg: "FEF2F2", bar: "DC2626", chip: "HIGH" }
    : { bg: "FFFBEB", bar: "D97706", chip: "MED" };
  g.addShape("roundRect", { x, y, w, h, rectRadius: 0.04, fill: { color: sev.bg }, line: { color: "E4E4E7", width: 0.75 } } as never);
  g.addShape("rect", { x, y, w: 0.09, h, fill: { color: sev.bar } } as never);
  // Filled severity chip (top-left). The text box gets zero inset and enough
  // width that "HIGH"/"MED" always render on one line — the default ~0.05" cell
  // inset squeezes "HIGH" into a wrap in PowerPoint.
  const chipW = 0.62;
  const chipH = 0.26;
  const chipX = x + 0.22;
  const chipY = y + 0.13;
  g.addShape("roundRect", { x: chipX, y: chipY, w: chipW, h: chipH, rectRadius: 0.05, fill: { color: sev.bar } } as never);
  g.addText(sev.chip, { x: chipX, y: chipY, w: chipW, h: chipH, fontFace: FONT, fontSize: 9, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, wrap: false } as never);
  // Title to the right of the chip (wraps within its box if long).
  g.addText(title, { x: chipX + chipW + 0.12, y: y + 0.07, w: w - chipW - 0.5, h: 0.38, fontFace: FONT, fontSize: 10.5, bold: true, color: NAVY, valign: "middle", fit: "shrink" } as never);
  // Body fills the remaining card height. Capped to ~two lines at 9pt so it fits
  // the body box without relying on autofit (which not every viewer honors).
  if (opts.body) {
    g.addText(trunc(opts.body, 130), {
      x: x + 0.24, y: y + 0.42, w: w - 0.42, h: Math.max(0.24, h - 0.48),
      fontFace: FONT, fontSize: 9, color: "3F3F46", valign: "top", fit: "shrink",
    } as never);
  }
}

// A completed-project chip: green check + name, an entity sublabel, and a green
// "100%" badge — the building block of a "Completed" wins slide.
export function completedItem(
  g: IPptxGenJSSlide,
  opts: { x: number; y: number; w: number; name: string; entity?: string | null },
) {
  const { x, y, w, name, entity } = opts;
  g.addText(
    [
      { text: "✓  ", options: { color: "16A34A", bold: true } },
      { text: trunc(name, 34), options: { color: NAVY, bold: true } },
    ] as never,
    { x, y, w: w - 0.66, h: 0.3, fontFace: FONT, fontSize: 10.5, valign: "middle" } as never,
  );
  g.addShape("roundRect", { x: x + w - 0.62, y: y + 0.02, w: 0.58, h: 0.26, rectRadius: 0.05, fill: { color: "DCFCE7" } } as never);
  g.addText("100%", { x: x + w - 0.62, y: y + 0.02, w: 0.58, h: 0.26, fontFace: FONT, fontSize: 9, bold: true, color: "15803D", align: "center", valign: "middle" } as never);
  if (entity) {
    g.addText(trunc(entity, 38), { x: x + 0.22, y: y + 0.27, w: w - 0.66, h: 0.22, fontFace: FONT, fontSize: 8.5, italic: true, color: GREY } as never);
  }
}

// A short brand accent rule under the title — a lime→navy two-tone bar that
// approximates the source decks' green-to-blue gradient stripe.
export function accentBar(g: IPptxGenJSSlide, y = 1.33) {
  g.addShape("rect", { x: CONTENT.x, y, w: 1.7, h: 0.07, fill: { color: "CAD400" } } as never);
  g.addShape("rect", { x: CONTENT.x + 1.7, y, w: 1.7, h: 0.07, fill: { color: NAVY } } as never);
}
