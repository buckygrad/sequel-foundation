import { createHash } from "node:crypto";
import type JSZip from "jszip";

// Post-assembly slimming for decks cloned out of a slide library with
// pptx-automizer. Two systematic sources of dead weight:
//
//   1. automizer re-copies a cloned slide's media under a fresh name
//      (media42.png) while the loaded root still carries the original
//      (image7.png) — every clone duplicates its images byte-for-byte;
//   2. the root keeps EVERY library part (all layouts, media, charts,
//      diagrams, notes) even when the assembled deck cloned three slides.
//
// `slimPresentationZip` fixes both in place: collapse byte-identical media
// onto one file, then walk the relationship graph from the presentation and
// its slides and drop the prunable part families nothing references. Combined
// with DEFLATE at generate time this is what keeps generated pitch decks small
// enough to survive Netlify's streamed-function response limits (large bodies
// are cut off mid-stream — see PR #135 for the branded-deck twin of this fix).

const PRUNABLE =
  /^ppt\/(media|charts|diagrams|notesSlides|slideLayouts|embeddings)\//;

function resolveTarget(baseDir: string, target: string): string {
  const out: string[] = [];
  for (const part of `${baseDir}/${target}`.split("/")) {
    if (part === "..") out.pop();
    else if (part !== "." && part !== "") out.push(part);
  }
  return out.join("/");
}

function relsPathFor(partName: string): string {
  const idx = partName.lastIndexOf("/");
  return `${partName.slice(0, idx)}/_rels/${partName.slice(idx + 1)}.rels`;
}

type Rel = { id: string; tag: string; resolved: string };

async function relsFor(zip: JSZip, partName: string): Promise<Rel[]> {
  const file = zip.file(relsPathFor(partName));
  if (!file) return [];
  const xml = await file.async("string");
  const baseDir = partName.slice(0, partName.lastIndexOf("/"));
  const rels: Rel[] = [];
  for (const m of xml.matchAll(/<Relationship\b[^>]*\/>/g)) {
    if (/TargetMode="External"/.test(m[0])) continue;
    const id = m[0].match(/Id="([^"]+)"/)?.[1];
    const target = m[0].match(/Target="([^"]+)"/)?.[1];
    if (id && target) rels.push({ id, tag: m[0], resolved: resolveTarget(baseDir, target) });
  }
  return rels;
}

// Collapse byte-identical ppt/media files onto the first-seen copy, rewriting
// every relationship Target that pointed at a duplicate.
async function dedupeMedia(zip: JSZip): Promise<void> {
  const canonicalByHash = new Map<string, string>();
  const duplicates = new Map<string, string>(); // dup path -> canonical path
  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith("ppt/media/") || zip.files[name].dir) continue;
    const hash = createHash("sha1")
      .update(await zip.file(name)!.async("nodebuffer"))
      .digest("hex");
    const canonical = canonicalByHash.get(hash);
    if (canonical) duplicates.set(name, canonical);
    else canonicalByHash.set(hash, name);
  }
  if (duplicates.size === 0) return;

  for (const name of Object.keys(zip.files)) {
    if (!name.endsWith(".rels") || zip.files[name].dir) continue;
    const baseDir = name.replace(/\/_rels\/[^/]+$/, "");
    let xml = await zip.file(name)!.async("string");
    let changed = false;
    xml = xml.replace(/Target="([^"]+)"/g, (whole, target: string) => {
      const canonical = duplicates.get(resolveTarget(baseDir, target));
      if (!canonical) return whole;
      changed = true;
      return `Target="${relativeMediaTarget(target, canonical)}"`;
    });
    if (changed) zip.file(name, xml);
  }
  for (const dup of duplicates.keys()) zip.remove(dup);
}

// Keep the original Target's path prefix (e.g. "../media/"), swap the basename.
function relativeMediaTarget(originalTarget: string, canonicalPath: string): string {
  const prefix = originalTarget.slice(0, originalTarget.lastIndexOf("/") + 1);
  const basename = canonicalPath.slice(canonicalPath.lastIndexOf("/") + 1);
  return `${prefix}${basename}`;
}

// Walk the relationship graph from the presentation + all slides and remove
// every prunable part nothing reachable references. Masters deliberately do
// NOT keep their layouts alive (a master lists every library layout); a layout
// survives only via some slide's rels, and dropped layouts are de-registered
// from their master (rels entry + <p:sldLayoutId>) so no dangling id remains.
async function pruneUnreachableParts(zip: JSZip): Promise<void> {
  const names = new Set(
    Object.keys(zip.files).filter((n) => !zip.files[n].dir),
  );
  const keep = new Set<string>();
  const queue: string[] = ["ppt/presentation.xml"];
  for (const name of names) {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) queue.push(name);
  }
  while (queue.length > 0) {
    const part = queue.pop()!;
    if (keep.has(part) || !names.has(part)) continue;
    keep.add(part);
    const isMaster = /^ppt\/slideMasters\//.test(part);
    for (const rel of await relsFor(zip, part)) {
      // A master's layout list spans the whole library; layouts must earn
      // their keep through a slide.
      if (isMaster && /^ppt\/slideLayouts\//.test(rel.resolved)) continue;
      queue.push(rel.resolved);
    }
  }

  // NB: `.rels` files live under the same directories (slideLayouts/_rels/…)
  // but are companions of their part, not parts — they are removed only
  // alongside their owner, never independently.
  const dropped = [...names].filter(
    (n) => PRUNABLE.test(n) && !n.includes("/_rels/") && !keep.has(n),
  );
  if (dropped.length === 0) return;
  let contentTypes = await zip.file("[Content_Types].xml")!.async("string");
  for (const name of dropped) {
    zip.remove(name);
    zip.remove(relsPathFor(name));
    contentTypes = contentTypes.replace(
      new RegExp(`<Override PartName="/${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*/>`),
      "",
    );
  }
  zip.file("[Content_Types].xml", contentTypes);

  // De-register dropped layouts from every master.
  const droppedLayouts = new Set(
    dropped.filter((n) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(n)),
  );
  if (droppedLayouts.size === 0) return;
  for (const masterName of [...names].filter((n) =>
    /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(n),
  )) {
    const relsName = relsPathFor(masterName);
    const relsFile = zip.file(relsName);
    if (!relsFile) continue;
    let relsXml = await relsFile.async("string");
    let masterXml = await zip.file(masterName)!.async("string");
    for (const rel of await relsFor(zip, masterName)) {
      if (!droppedLayouts.has(rel.resolved)) continue;
      relsXml = relsXml.replace(rel.tag, "");
      masterXml = masterXml.replace(
        new RegExp(`<p:sldLayoutId\\b[^>]*r:id="${rel.id}"[^>]*/>`),
        "",
      );
    }
    zip.file(relsName, relsXml);
    zip.file(masterName, masterXml);
  }
}

export async function slimPresentationZip(zip: JSZip): Promise<void> {
  await dedupeMedia(zip);
  await pruneUnreachableParts(zip);
}
