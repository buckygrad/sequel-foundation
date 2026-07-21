import { describe, expect, it } from "vitest";
import { snapshotEqual, shallowDirty, type FormSnapshot } from "../ui/form-dirty";

// Pure halves of the save-surface kit (§3 save conventions): one definition
// of "dirty" for controlled and uncontrolled forms. formSnapshot itself needs
// a DOM and is exercised by the adopting apps' component tests.

describe("snapshotEqual", () => {
  it("equal snapshots compare true regardless of key order", () => {
    const a: FormSnapshot = { name: "x", tags: ["a", "b"] };
    const b: FormSnapshot = { tags: ["a", "b"], name: "x" };
    expect(snapshotEqual(a, b)).toBe(true);
  });

  it("detects changed, added, and removed values", () => {
    const base: FormSnapshot = { name: "x", pct: "80" };
    expect(snapshotEqual(base, { name: "x", pct: "100" })).toBe(false);
    expect(snapshotEqual(base, { name: "x" })).toBe(false);
    expect(snapshotEqual(base, { name: "x", pct: "80", extra: "1" })).toBe(false);
  });

  it("compares multi-valued keys element-wise (checkbox groups)", () => {
    expect(snapshotEqual({ t: ["a", "b"] }, { t: ["a", "b"] })).toBe(true);
    expect(snapshotEqual({ t: ["a", "b"] }, { t: ["b", "a"] })).toBe(false);
    expect(snapshotEqual({ t: ["a"] }, { t: "a" })).toBe(true); // single-vs-array same value
  });
});

describe("shallowDirty", () => {
  it("clean when every key matches by Object.is", () => {
    expect(shallowDirty({ a: 1, b: null }, { a: 1, b: null })).toBe(false);
  });

  it("clearing a field is a change — '' vs null are distinct", () => {
    expect(shallowDirty({ a: "" }, { a: null })).toBe(true);
  });

  it("added/removed keys are dirty", () => {
    expect(shallowDirty({ a: 1 }, { a: 1, b: 2 })).toBe(true);
    expect(shallowDirty({ a: 1, b: 2 }, { a: 1 })).toBe(true);
  });
});

describe("snapshotChangedKeys", () => {
  it("names changed, added, and removed keys; absent equals empty string", async () => {
    const { snapshotChangedKeys } = await import("../ui/form-dirty");
    const base = { name: "x", pct: "80", tags: ["a", "b"] };
    expect(snapshotChangedKeys(base, { name: "x", pct: "100", tags: ["a", "b"] })).toEqual(["pct"]);
    expect(
      snapshotChangedKeys(base, { name: "x", pct: "80", tags: ["a"], extra: "1" }).sort(),
    ).toEqual(["extra", "tags"]);
    // A key that disappears with value "" is not a change (unchecked checkbox
    // vs empty field parity).
    expect(snapshotChangedKeys({ note: "" }, {})).toEqual([]);
    expect(snapshotChangedKeys({ box: "on" }, {})).toEqual(["box"]);
  });
});
