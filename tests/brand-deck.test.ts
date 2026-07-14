// brand-deck engine mechanics: buildEmptyRoot on a synthetic template zip,
// dedupeShapeIds, and the engine's brand-config resolution. Full
// buildBrandedDeck assembly is covered in each app against its real committed
// template (shape-level exporter tests) — a faithful template fixture is too
// heavy to synthesize here.

import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  buildEmptyRoot,
  createBrandDeckEngine,
  dedupeShapeIds,
  th,
  td,
  trunc,
  money,
  pct,
  emphasizeCells,
  CRITICAL_FILL,
} from "../deck-kit/brand-deck";

const RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

async function syntheticTemplate(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`,
  );
  zip.file(
    "ppt/presentation.xml",
    `<p:presentation><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`,
  );
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    `<?xml version="1.0"?><Relationships xmlns="${RELS_NS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>`,
  );
  zip.file("ppt/slides/slide1.xml", "<p:sld/>");
  zip.file("ppt/slides/slide2.xml", "<p:sld/>");
  zip.file(
    "ppt/slides/_rels/slide1.xml.rels",
    `<?xml version="1.0"?><Relationships xmlns="${RELS_NS}"/>`,
  );
  zip.file("ppt/slideMasters/slideMaster1.xml", "<p:sldMaster/>");
  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}

describe("buildEmptyRoot", () => {
  it("strips slides, slide rels, slide-list entries, and content-type overrides — keeps the master", async () => {
    const out = await buildEmptyRoot(await syntheticTemplate());
    const zip = await JSZip.loadAsync(out);

    expect(zip.file("ppt/slides/slide1.xml")).toBeNull();
    expect(zip.file("ppt/slides/slide2.xml")).toBeNull();
    expect(zip.file("ppt/slides/_rels/slide1.xml.rels")).toBeNull();
    expect(zip.file("ppt/slideMasters/slideMaster1.xml")).toBeTruthy();

    const pres = await zip.file("ppt/presentation.xml")!.async("string");
    expect(pres).toContain("<p:sldIdLst/>");

    const rels = await zip.file("ppt/_rels/presentation.xml.rels")!.async("string");
    expect(rels).not.toContain("slides/slide1.xml");
    expect(rels).toContain("slideMasters/slideMaster1.xml");

    const ct = await zip.file("[Content_Types].xml")!.async("string");
    expect(ct).not.toContain("/ppt/slides/slide1.xml");
  });
});

describe("dedupeShapeIds", () => {
  it("renumbers colliding cNvPr ids sequentially", () => {
    const xml = `<p:sp><p:cNvPr id="2" name="a"/></p:sp><p:sp><p:cNvPr id="2" name="b"/></p:sp><p:sp><p:cNvPr id="5" name="c"/></p:sp>`;
    const out = dedupeShapeIds(xml);
    expect(out).toContain('<p:cNvPr id="1" name="a"');
    expect(out).toContain('<p:cNvPr id="2" name="b"');
    expect(out).toContain('<p:cNvPr id="3" name="c"');
  });
});

describe("createBrandDeckEngine", () => {
  const engine = createBrandDeckEngine<"SEQ" | "ON">({
    templatePath: "/nonexistent.pptx", // never loaded by these assertions
    defaultBrand: "SEQ",
    brands: {
      SEQ: { key: "SEQ", label: "Sequel Ortho", cover: 8, divider: 9, content: 10, coverTitle: "Title 1", coverSubtitle: "Subtitle 2", dividerTitle: "Title 1", contentTitle: "Title 1", headerFill: "0F1263" },
      ON: { key: "ON", label: "OrthoNebraska", cover: 1, divider: 2, content: 3, coverTitle: "Title 1", coverSubtitle: "Subtitle 2", dividerTitle: "Title 1", contentTitle: "Title 2", headerFill: "25245C" },
    },
  });

  it("resolves brand config with a default", () => {
    expect(engine.headerFill()).toBe("0F1263");
    expect(engine.headerFill("ON")).toBe("25245C");
    expect(engine.brandLabel("ON")).toBe("OrthoNebraska");
    expect(engine.brandLabel()).toBe("Sequel Ortho");
  });

  it("requires a template source", () => {
    expect(() =>
      createBrandDeckEngine({ defaultBrand: "X", brands: { X: {} as never } }),
    ).toThrow(/templatePath or loadTemplate/);
  });
});

describe("cell + formatting primitives", () => {
  it("th supports fill/fontSize/align superset", () => {
    const cell = th("Progress", "25245C", 9, "center");
    expect(cell.options).toMatchObject({ fill: { color: "25245C" }, fontSize: 9, align: "center", bold: true });
  });

  it("money/pct/trunc format like the hubs", () => {
    expect(money(0)).toBe("—");
    expect(money(1234567)).toBe("$1,234,567");
    expect(pct(null)).toBe("–");
    expect(pct(0.505)).toBe("51%");
    expect(trunc("abcdef", 4)).toBe("abc…");
    expect(trunc(null, 4)).toBe("");
  });

  it("emphasizeCells flags rows maroon but keeps status dots their own color", () => {
    const row = [td("Item"), { text: "●", options: { color: "16A34A" } }];
    const out = emphasizeCells(row);
    expect(out[0].options).toMatchObject({ fill: { color: CRITICAL_FILL }, bold: true });
    expect(out[1].options).toMatchObject({ fill: { color: CRITICAL_FILL }, color: "16A34A" });
  });
});
