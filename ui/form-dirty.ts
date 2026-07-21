// Dirty detection for save surfaces (DESIGN-CONVENTIONS §3: "Save is disabled
// until something actually changed"). Pure snapshot/compare helpers so both
// controlled forms (compare state objects) and uncontrolled forms (snapshot
// FormData on mount, compare on input) share one definition of "dirty".

export type FormSnapshot = Record<string, string | string[]>;

/** FormData → plain comparable snapshot (multi-valued keys become arrays). */
export function formSnapshot(form: HTMLFormElement): FormSnapshot {
  const out: FormSnapshot = {};
  const data = new FormData(form);
  for (const key of new Set(data.keys())) {
    const values = data.getAll(key).map((v) => (typeof v === "string" ? v : v.name));
    out[key] = values.length === 1 ? values[0] : values;
  }
  return out;
}

/** Deep-enough equality for snapshots: same keys, same string(s) per key. */
export function snapshotEqual(a: FormSnapshot, b: FormSnapshot): boolean {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    const av = a[k];
    const bv = b[k];
    if (Array.isArray(av) || Array.isArray(bv)) {
      const aa = Array.isArray(av) ? av : [av];
      const ba = Array.isArray(bv) ? bv : [bv];
      if (aa.length !== ba.length || aa.some((v, i) => v !== ba[i])) return false;
    } else if (av !== bv) {
      return false;
    }
  }
  return true;
}

/**
 * Shallow object compare for controlled forms: dirty when any own key of
 * `current` differs from `initial` by Object.is. (Nullish and "" are distinct
 * on purpose — clearing a field is a change.)
 */
export function shallowDirty(
  initial: Record<string, unknown>,
  current: Record<string, unknown>,
): boolean {
  const keys = new Set([...Object.keys(initial), ...Object.keys(current)]);
  for (const k of keys) if (!Object.is(initial[k], current[k])) return true;
  return false;
}
