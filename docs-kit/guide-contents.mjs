import { Bookmark, InternalHyperlink, Paragraph } from "docx";

// Shared clickable-Contents machinery for Sequel guide builders (user guides,
// reviewer guides, procedures docs — the "edit the script, regenerate, commit
// the .docx" convention): each heading carries a positional bookmark, and the
// Contents page is a hyperlinked outline built from those bookmarks — NOT a Word
// TOC field. A field shows nothing until the reader accepts an "update fields?"
// prompt and its page numbers are otherwise blank/stale; this outline is correct
// the moment the file opens, in any viewer, with zero user action. No page
// numbers — a .docx can't fill those without a layout pass or a user prompt, and
// for an on-screen guide a click-to-jump outline removes the only thing that
// could be inaccurate.

// A fresh anchor generator per document: () => "toc1", "toc2", …
export function makeAnchorGen() {
  let n = 0;
  return () => `toc${++n}`;
}

// Wrap a heading's runs in a bookmark so the Contents can link straight to it.
export function bookmarked(anchor, runs) {
  return new Bookmark({ id: anchor, children: runs });
}

// Build the Contents entry paragraphs from heading paragraphs stamped with
// `__outline = { level, text, anchor }`. `entryRun(level, text)` returns the
// styled TextRun for an entry, so each guide keeps its own brand styling.
export function contentsEntries(elements, entryRun) {
  return elements
    .filter((el) => el && el.__outline)
    .map((el) => {
      const { level, text, anchor } = el.__outline;
      return new Paragraph({
        spacing: { after: level === 1 ? 60 : 40 },
        indent: level === 1 ? undefined : { left: level === 2 ? 360 : 720 },
        children: [new InternalHyperlink({ anchor, children: [entryRun(level, text)] })],
      });
    });
}
