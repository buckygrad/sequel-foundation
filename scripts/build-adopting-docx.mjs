#!/usr/bin/env node
// Regenerates the shareable "Building on the Sequel Foundation" quick-start
// docx from the content of ADOPTING.md (hand-mirrored below, same convention
// as the hubs' guide scripts). Run whenever ADOPTING.md changes:
//
//   node scripts/build-adopting-docx.mjs [output.docx]
//
// Default output: ./Sequel-Foundation-Quick-Start.docx (pass a path to write
// elsewhere, e.g. ~/Desktop). The docx previously had no committed generator
// and drifted silently — this script is now the only way it gets built.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Document, Packer, Paragraph, TextRun, ExternalHyperlink, ImageRun, Table,
  TableRow, TableCell, WidthType, BorderStyle, ShadingType,
} from "docx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(process.argv[2] ?? join(ROOT, "Sequel-Foundation-Quick-Start.docx"));

// Brand constants — keep in sync with docs-kit/docx-brand.ts (an .mjs script
// can't import the TS module directly).
const FONT = "Montserrat";
const NAVY = "0F1263";
const BLUE = "009DDD";
const GREY = "707372";
const SURFACE = "F8F8F8";

const PIN = "v0.3.1"; // current release tag — bump alongside package.json

const run = (text, opts = {}) => new TextRun({ text, font: FONT, size: 21, ...opts });
const b = (text, opts = {}) => run(text, { bold: true, ...opts });
const code = (text) => new TextRun({ text, font: "Geist Mono", size: 19 });
const link = (text, url) =>
  new ExternalHyperlink({
    children: [new TextRun({ text, font: FONT, size: 21, color: BLUE, underline: {} })],
    link: url,
  });

const p = (children, opts = {}) =>
  new Paragraph({ children: Array.isArray(children) ? children : [run(children)], spacing: { after: 140 }, ...opts });
const h2 = (text) =>
  new Paragraph({
    children: [new TextRun({ text, font: FONT, bold: true, color: NAVY, size: 28 })],
    spacing: { before: 260, after: 120 },
  });
const codeBlock = (lines) =>
  lines.map(
    (l, i) =>
      new Paragraph({
        children: [code(l)],
        shading: { type: ShadingType.CLEAR, fill: SURFACE },
        spacing: { after: i === lines.length - 1 ? 160 : 0 },
        indent: { left: 240 },
      }),
  );
const bullet = (children) =>
  new Paragraph({ children, bullet: { level: 0 }, spacing: { after: 100 } });

const cell = (children, { header = false, width } = {}) =>
  new TableCell({
    children: [new Paragraph({ children, spacing: { after: 40, before: 40 } })],
    shading: header ? { type: ShadingType.CLEAR, fill: NAVY } : undefined,
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    margins: { left: 120, right: 120, top: 40, bottom: 40 },
  });
const headerRun = (text) => new TextRun({ text, font: FONT, bold: true, color: "FFFFFF", size: 20 });

const banner = new Paragraph({
  children: [
    new ImageRun({
      type: "png",
      data: readFileSync(join(ROOT, "brand/assets/banner.png")),
      transformation: { width: 620, height: 96 },
    }),
  ],
  spacing: { after: 200 },
});

const boxRows = [
  ["…/brand/theme.css", "Brand tokens with dark mode, RYG status colors, focus ring, print rules"],
  ["…/theme", "Light / Dark / Browser theme with a no-flash pre-hydration script"],
  ["…/ui", "Button (incl. the chartreuse assign/hand-off variant), Callout, Field, badges, toasts (with next-step action links), ShowMore, Breadcrumbs, ExportBar"],
  ["…/llm", "Claude client seam, per-task model configuration with fallback, streaming that survives serverless timeouts"],
  ["…/deck-kit", "Branded PowerPoint engine (approved template, native editable charts, auto-slimming)"],
  ["…/docs-kit/*", "Word/Excel brand constants and styles, clickable-contents machinery for generated guides"],
];

const doc = new Document({
  styles: { default: { document: { run: { font: FONT } } } },
  sections: [
    {
      properties: { page: { margin: { top: 1080, bottom: 1080, left: 1440, right: 1440 } } },
      children: [
        banner,
        new Paragraph({
          children: [new TextRun({ text: "Building on the Sequel Foundation", font: FONT, bold: true, color: NAVY, size: 40 })],
          spacing: { after: 60 },
        }),
        p([new TextRun({ text: "Developer quick start · July 2026", font: FONT, color: GREY, size: 21 })]),
        p([
          run("Sequel Ortho applications share one platform layer: "),
          code("@sequel/foundation"),
          run(" ("),
          link("github.com/buckygrad/sequel-foundation", "https://github.com/buckygrad/sequel-foundation"),
          run("). It carries the SequelOrtho brand theme with dark mode, the shared UI components and UX conventions, the branded PowerPoint/Excel/Word export machinery, and our Claude (AI) integration patterns — all extracted from "),
          link("Project Hub", "https://sequelorthoprojects.com"),
          run(" and the "),
          link("Acquisition Hub", "https://sequelorthoplaybook.com"),
          run(", which both run on it in production today. Build on it and your tool automatically looks, feels, and exports like the rest of the family."),
        ]),

        h2("Starting a new application (the fast path)"),
        p("Create your repo from the template — it boots already themed, with working sample exports and the AI pattern wired:"),
        ...codeBlock([
          "gh repo create my-new-app --private \\",
          "  --template buckygrad/sequel-app-template --clone",
          "cd my-new-app && npm install && npm run dev",
        ]),
        p([
          run("Then work through the short "),
          b("Template checklist"),
          run(" at the bottom of the repo's "),
          code("CLAUDE.md"),
          run(" — rename the app, pick a theme-storage key, set "),
          code("ANTHROPIC_API_KEY"),
          run(", and replace the sample pages/exports with your own."),
        ]),

        h2("Adding the foundation to an existing application"),
        p([b("1. Install"), run(" (public repo — no tokens needed anywhere):")]),
        ...codeBlock([
          `npm i "@sequel/foundation@github:buckygrad/sequel-foundation#${PIN}"`,
          `// next.config.ts:  transpilePackages: ["@sequel/foundation"]`,
        ]),
        p([b("2. Styles"), run(" — in "), code("app/globals.css"), run(":")]),
        ...codeBlock([
          `@import "tailwindcss";`,
          `@import "@sequel/foundation/brand/theme.css";`,
          `@source "../node_modules/@sequel/foundation";`,
        ]),
        p([
          b("3. Layout"),
          run(" — load Montserrat + Geist Mono via "),
          code("next/font"),
          run(", render "),
          code("themeInitScript(<your key>)"),
          run(" as the first element of "),
          code("<body>"),
          run(", and put "),
          code("<ThemeToggle storageKey={…}/>"),
          run(" in your header. Copy the exact wiring from the template's "),
          link("app/layout.tsx", "https://github.com/buckygrad/sequel-app-template/blob/main/app/layout.tsx"),
          run("."),
        ]),

        h2("What's in the box"),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
            left: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
            right: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
            insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "DDDDDD" },
          },
          rows: [
            new TableRow({
              tableHeader: true,
              children: [cell([headerRun("Import path")], { header: true, width: 28 }), cell([headerRun("What you get")], { header: true, width: 72 })],
            }),
            ...boxRows.map(
              ([path, what]) =>
                new TableRow({ children: [cell([code(path)], { width: 28 }), cell([run(what, { size: 20 })], { width: 72 })] }),
            ),
          ],
        }),
        new Paragraph({ children: [], spacing: { after: 60 } }),
        p([
          run("The full subpath reference and consumption details are in the "),
          link("README", "https://github.com/buckygrad/sequel-foundation#readme"),
          run("."),
        ]),

        h2("House rules"),
        bullet([
          b("Read the two docs first. "),
          link("DESIGN-CONVENTIONS.md", "https://github.com/buckygrad/sequel-foundation/blob/main/docs/DESIGN-CONVENTIONS.md"),
          run(" (the UX rules that make Sequel apps feel like one product — including §3's post-action feedback rule and §5's navigation patterns) and "),
          link("DECK-CRAFT.md", "https://github.com/buckygrad/sequel-foundation/blob/main/docs/DECK-CRAFT.md"),
          run(" (everything we learned generating board-quality decks) will save you weeks."),
        ]),
        bullet([
          b("Every action confirms; no page dead-ends. "),
          run("Mutations pop a "),
          code("toastSaved"),
          run(" confirmation — with an action link when there's a natural next step — and every leaf page links onward. Before shipping a PR that adds or moves a screen, run the §5a nav/flow review checklist in DESIGN-CONVENTIONS.md."),
        ]),
        bullet([
          b("Never copy foundation code into your app. "),
          run("To change anything shared, make the change in sequel-foundation, tag a release, and bump the version pin in each app. That's what keeps every tool consistent."),
        ]),
        bullet([
          b("Pin a tag, not main. "),
          run("Your "),
          code("package.json"),
          run(` references a version tag (e.g. `),
          code(`#${PIN}`),
          run("), so foundation changes never reach your app until you choose to take them."),
        ]),
        bullet([
          b("AI calls follow the pattern. "),
          run("Models come from configuration ("),
          code("modelFor"),
          run(" + "),
          code("withModelFallback"),
          run("), responses stream ("),
          code("streamJob"),
          run(" / "),
          code("consumeLlmStream"),
          run("), errors are typed. The template's "),
          code("ai-demo"),
          run(" route is the reference."),
        ]),

        h2("Links"),
        bullet([link("sequel-foundation", "https://github.com/buckygrad/sequel-foundation"), run(" — the shared package + the two convention docs")]),
        bullet([link("sequel-app-template", "https://github.com/buckygrad/sequel-app-template"), run(" — the new-app starter (GitHub template repo)")]),
        bullet([
          run("Live examples: "),
          link("Project Hub", "https://sequelorthoprojects.com"),
          run(" and the "),
          link("Acquisition Hub", "https://sequelorthoplaybook.com"),
          run(" both run on the foundation in production."),
        ]),
        p([
          new TextRun({
            text: "Questions or a change you need in the shared layer? Bring it to the platform owner — small foundation releases ship same-day.",
            font: FONT, italics: true, color: GREY, size: 20,
          }),
        ]),
      ],
    },
  ],
});

const buf = await Packer.toBuffer(doc);
writeFileSync(OUT, buf);
console.log(`✓ wrote ${OUT} (${buf.length.toLocaleString()} bytes)`);
