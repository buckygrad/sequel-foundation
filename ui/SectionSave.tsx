"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "./Button";
import { SaveStateIndicator } from "./SaveState";
import { formSnapshot, snapshotEqual, type FormSnapshot } from "./form-dirty";

// Save-surface kit (DESIGN-CONVENTIONS §3, the save conventions):
//   1. Saving keeps you in place — confirm with a toast + the SaveState chip;
//      never navigate away on success. Navigation is the user's move.
//   2. Save is disabled until something actually changed (dirty-aware), with
//      the reason on the disabled control's title.
//   3. Long forms save per section — each section carries its own compact
//      Save bar so the user never scrolls to commit; a bottom Save-all stays
//      for the full sweep. Both are dirty-aware.
// useSaveRunner holds the async lifecycle; SectionSaveBar is the standard
// affordance (button + SaveStateIndicator + inline error); useFormDirty wires
// dirty detection onto an uncontrolled <form> via snapshot/compare.

export type SaveRunner = {
  saving: boolean;
  savedAt: number | null;
  error: string | null;
  /** Run the save; resolves true on success. Errors land in `error`. */
  run: () => Promise<boolean>;
};

/**
 * Async save lifecycle for one save surface (a section or a whole form).
 * `onSave` returning `false` (or throwing) marks failure; anything else marks
 * success and stamps `savedAt`. Fire the confirmation toast inside `onSave` —
 * messages are the app's voice, the runner only tracks state.
 */
export function useSaveRunner(onSave: () => Promise<boolean | void>): SaveRunner {
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await onSave();
      const ok = result !== false;
      if (ok) setSavedAt(Date.now());
      else setError("Save failed.");
      return ok;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [onSave]);
  return { saving, savedAt, error, run };
}

/**
 * Dirty detection for an uncontrolled form (or one form SECTION): snapshot on
 * first input-capable render, recompare on every input/change event.
 *
 *   const d = useFormDirty();
 *   <form ref={d.attach} onInput={d.recheck} onChange={d.recheck}>…</form>
 *   // after a successful save: d.markClean()
 */
export function useFormDirty() {
  const formRef = useRef<HTMLFormElement | null>(null);
  const baseline = useRef<FormSnapshot | null>(null);
  const [dirty, setDirty] = useState(false);
  const attach = useCallback((el: HTMLFormElement | null) => {
    formRef.current = el;
    if (el && baseline.current === null) baseline.current = formSnapshot(el);
  }, []);
  const recheck = useCallback(() => {
    const el = formRef.current;
    if (!el || baseline.current === null) return;
    setDirty(!snapshotEqual(baseline.current, formSnapshot(el)));
  }, []);
  const markClean = useCallback(() => {
    const el = formRef.current;
    if (el) baseline.current = formSnapshot(el);
    setDirty(false);
  }, []);
  return { attach, recheck, markClean, dirty };
}

/**
 * The standard save affordance: dirty-disabled Save + SaveState chip + inline
 * error. Use size "sm" inside sections, "md" for the bottom Save-all.
 */
export function SectionSaveBar({
  dirty,
  runner,
  label = "Save",
  size = "sm",
  disabled = false,
}: {
  dirty: boolean;
  runner: SaveRunner;
  label?: string;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const blocked = disabled || !dirty || runner.saving;
  return (
    <div className="flex flex-wrap items-center gap-3" data-no-print>
      <Button
        type="button"
        size={size}
        disabled={blocked}
        title={!dirty && !runner.saving ? "No changes to save" : undefined}
        onClick={() => void runner.run()}
      >
        {label}
      </Button>
      <SaveStateIndicator saving={runner.saving} dirty={dirty && !runner.saving} savedAt={runner.savedAt} />
      {runner.error && (
        <span role="alert" className="text-xs text-red-700 dark:text-red-400">
          {runner.error}
        </span>
      )}
    </div>
  );
}
