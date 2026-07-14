"use client";

import { useState, type ReactNode } from "react";

// Shared progressive-disclosure primitive (2026 scroll review) — the exact
// "Show N more / Show all (X) / Show fewer" pattern from the VCP Value
// delivery list, extracted so every long list in the Hub clamps the same way.
//
// Three entry points:
//  - useShowMore + ShowMoreControls — for client components that own their own
//    markup (filtered tables, card lists).
//  - ShowMoreTbody — for tables rendered by SERVER components: the server keeps
//    its <table>/<thead>, passes the <tr> nodes, and the controls render as a
//    final row spanning the table (ReactNode[] is RSC-serializable).
//  - ShowMoreList — for server-rendered flat lists (ul / div stacks): renders
//    the container plus the controls line after it.

export function useShowMore<T>(items: readonly T[], initial = 5, step = 5) {
  const [count, setCount] = useState(initial);

  const visible = items.slice(0, count) as T[];
  const remaining = items.length - visible.length;

  return {
    visible,
    remaining,
    total: items.length,
    expandable: items.length > initial,
    expanded: count > initial,
    step,
    showMore: () => setCount((c) => Math.min(items.length, c + step)),
    showAll: () => setCount(items.length),
    collapse: () => setCount(initial),
  };
}

type Controls = Pick<
  ReturnType<typeof useShowMore>,
  "remaining" | "total" | "expanded" | "step" | "showMore" | "showAll" | "collapse"
>;

// The footer line: "Showing X of Y" + the three actions. Render it only when
// the caller's list is expandable (matches the VCP pattern exactly).
export function ShowMoreControls({ remaining, total, expanded, step, showMore, showAll, collapse, className }: Controls & { className?: string }) {
  const shown = total - remaining;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 ${className ?? ""}`}>
      <p aria-live="polite" className="text-xs text-brand-muted">
        Showing {shown} of {total}
      </p>
      <div className="flex items-center gap-4">
        {remaining > 0 && (
          <>
            <button type="button" onClick={showMore} className="text-sm font-medium text-brand hover:underline">
              Show {Math.min(step, remaining)} more
            </button>
            <button type="button" onClick={showAll} className="text-sm font-medium text-brand hover:underline">
              Show all ({total})
            </button>
          </>
        )}
        {expanded && (
          <button
            type="button"
            onClick={(e) => {
              // Scroll the enclosing list (marked data-showmore) back into view
              // on collapse — event-time DOM lookup, not a hook-held ref (the
              // react-hooks/refs compiler rule forbids ref access in render).
              const region = e.currentTarget.closest("[data-showmore]");
              collapse();
              region?.scrollIntoView?.({ block: "nearest" });
            }}
            className="text-sm font-medium text-red-700 dark:text-red-400 hover:text-red-800 hover:underline"
          >
            Show fewer
          </button>
        )}
      </div>
    </div>
  );
}

// Server-table adapter: <table><thead>…</thead><ShowMoreTbody rows={trs} colSpan={n} /></table>.
// The controls live in a final spanning row so no table restructuring is needed.
export function ShowMoreTbody({
  rows,
  colSpan,
  initial = 10,
  step = 10,
  className,
}: {
  rows: ReactNode[];
  colSpan: number;
  initial?: number;
  step?: number;
  className?: string;
}) {
  const sm = useShowMore(rows, initial, step);
  return (
    <tbody className={className} data-showmore="">
      {sm.visible}
      {sm.expandable && (
        <tr className="border-t border-zinc-100 dark:border-zinc-800">
          <td colSpan={colSpan} className="py-2">
            <ShowMoreControls {...sm} />
          </td>
        </tr>
      )}
    </tbody>
  );
}

// Server-list adapter for flat stacks: renders the container (ul for <li>
// items, div otherwise) with the visible items, controls after it.
export function ShowMoreList({
  items,
  as = "div",
  className,
  initial = 5,
  step = 5,
}: {
  items: ReactNode[];
  as?: "ul" | "div";
  className?: string;
  initial?: number;
  step?: number;
}) {
  const sm = useShowMore(items, initial, step);
  const Container = as;
  return (
    <div data-showmore="">
      <Container className={className}>{sm.visible}</Container>
      {sm.expandable && <ShowMoreControls {...sm} className="mt-2" />}
    </div>
  );
}
