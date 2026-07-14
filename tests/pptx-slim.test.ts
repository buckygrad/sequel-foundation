// slimPresentationZip on a synthetic minimal deck: byte-identical media
// collapse (with rels rewritten) and unreachable-part pruning.

import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { slimPresentationZip } from "../deck-kit/pptx-slim";

const RELS = (entries: string) =>
  `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${entries}</Relationships>`;

function buildFixture(): JSZip {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/><Default Extension="xml" ContentType="application/xml"/></Types>`,
  );
  zip.file("ppt/presentation.xml", "<p:presentation/>");
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    RELS(`<Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/>`),
  );
  zip.file("ppt/slides/slide1.xml", "<p:sld/>");
  zip.file(
    "ppt/slides/_rels/slide1.xml.rels",
    RELS(
      `<Relationship Id="rId1" Type="image" Target="../media/image1.png"/><Relationship Id="rId2" Type="image" Target="../media/image2.png"/>`,
    ),
  );
  // image2 is byte-identical to image1 → dedupe target; image3 is unreferenced → prune target.
  zip.file("ppt/media/image1.png", Buffer.from("same-bytes"));
  zip.file("ppt/media/image2.png", Buffer.from("same-bytes"));
  zip.file("ppt/media/image3.png", Buffer.from("orphan-bytes"));
  return zip;
}

describe("slimPresentationZip", () => {
  it("collapses duplicate media, rewrites rels, and prunes unreachable media", async () => {
    const zip = buildFixture();
    await slimPresentationZip(zip);

    expect(zip.file("ppt/media/image1.png")).toBeTruthy();
    expect(zip.file("ppt/media/image2.png")).toBeNull();
    expect(zip.file("ppt/media/image3.png")).toBeNull();

    const rels = await zip.file("ppt/slides/_rels/slide1.xml.rels")!.async("string");
    expect(rels).toContain('Target="../media/image1.png"');
    expect(rels).not.toContain("image2.png");
  });

  it("keeps reachable parts and the presentation itself", async () => {
    const zip = buildFixture();
    await slimPresentationZip(zip);
    expect(zip.file("ppt/presentation.xml")).toBeTruthy();
    expect(zip.file("ppt/slides/slide1.xml")).toBeTruthy();
  });
});
