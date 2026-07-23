"use client";

import { useSyncExternalStore } from "react";

// Module-level navigation-progress store (same shape as ui/toast/store.ts):
// plain imperative functions so any code — the global click listener in
// <NavProgress/>, or a fetch-then-router.push flow — can start/finish the bar
// without threading a context, and the single <NavProgress/> subscribes via
// useSyncExternalStore.
//
// Phases: idle → active (bar crawling) → done (full-width fade-out) → idle.
// A navigation that completes faster than SHOW_DELAY_MS skips the done flash
// entirely — sub-perceptible waits must never flicker (NN/g response-time
// limits: feedback is for the >1s band).

export type NavProgressPhase = "idle" | "active" | "done";
export type NavProgressSnapshot = { phase: NavProgressPhase; generation: number };

// Keep in sync with the 6%-of-8s opacity hold in theme.css seq-nav-progress.
const SHOW_DELAY_MS = 250;
const DONE_MS = 300;
// A start with no route change (aborted nav, hash-only popstate) self-clears.
const FAIL_SAFE_MS = 15_000;

let snapshot: NavProgressSnapshot = { phase: "idle", generation: 0 };
let startedAt = 0;
let doneTimer: ReturnType<typeof setTimeout> | null = null;
let failSafeTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setPhase(phase: NavProgressPhase, bumpGeneration = false) {
  snapshot = {
    phase,
    generation: bumpGeneration ? snapshot.generation + 1 : snapshot.generation,
  };
  emit();
}

function clearTimers() {
  if (doneTimer) {
    clearTimeout(doneTimer);
    doneTimer = null;
  }
  if (failSafeTimer) {
    clearTimeout(failSafeTimer);
    failSafeTimer = null;
  }
}

export function startNavProgress() {
  clearTimers();
  startedAt = Date.now();
  failSafeTimer = setTimeout(() => {
    failSafeTimer = null;
    setPhase("idle");
  }, FAIL_SAFE_MS);
  // Bump the generation even when already active so the CSS crawl restarts
  // (the component keys the bar element on it).
  setPhase("active", true);
}

export function endNavProgress() {
  if (snapshot.phase !== "active") return;
  clearTimers();
  if (Date.now() - startedAt < SHOW_DELAY_MS) {
    // The bar never became visible — finish silently.
    setPhase("idle");
    return;
  }
  setPhase("done");
  doneTimer = setTimeout(() => {
    doneTimer = null;
    if (snapshot.phase === "done") setPhase("idle");
  }, DONE_MS);
}

// Test-only: reset module state between cases.
export function resetNavProgress() {
  clearTimers();
  snapshot = { phase: "idle", generation: 0 };
  startedAt = 0;
  emit();
}

export function getNavProgress(): NavProgressSnapshot {
  return snapshot;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getSnapshot() {
  return snapshot;
}

export function useNavProgress(): NavProgressSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Pure predicate for the document-level click listener: does this click start
// a same-origin route navigation the bar should track? Plain-values signature
// so it unit-tests in the node environment.
export type NavClickInfo = {
  /** The anchor's href attribute (may be relative); null when absent. */
  href: string | null;
  /** The anchor's target attribute, if any. */
  targetAttr: string | null;
  /** Whether the anchor carries a download attribute. */
  hasDownload: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  /** window.location.href at click time. */
  currentHref: string;
};

export function clickStartsNavigation(info: NavClickInfo): boolean {
  if (info.defaultPrevented) return false;
  // Modified/middle clicks open new tabs — the current view never leaves.
  if (info.button !== 0 || info.metaKey || info.ctrlKey || info.shiftKey || info.altKey) {
    return false;
  }
  if (info.hasDownload) return false;
  if (info.targetAttr && info.targetAttr !== "_self") return false;
  if (!info.href) return false;
  let current: URL;
  let dest: URL;
  try {
    current = new URL(info.currentHref);
    dest = new URL(info.href, current);
  } catch {
    return false;
  }
  // Cross-origin (and mailto:/tel:, whose origin is "null") leaves the app.
  if (dest.origin !== current.origin) return false;
  // Same path + search covers both hash-only jumps and re-clicking the
  // current page — neither blocks on server work.
  if (dest.pathname + dest.search === current.pathname + current.search) return false;
  return true;
}
