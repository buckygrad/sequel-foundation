"use client";

import { useSyncExternalStore } from "react";

// Module-level toast store. Save paths call pushToast/toastSaved/toastError
// imperatively — they are plain functions, not hooks, so any code can fire a
// toast without threading a context through every editor. The single
// <ToastViewport> subscribes via useToasts() (useSyncExternalStore, per the
// repo convention over set-state-in-effect).

export type ToastTone = "success" | "info" | "danger";
export type ToastAction = { label: string; href: string };
export type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
  ttl: number;
  action?: ToastAction;
};

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function pushToast(
  message: string,
  opts: { tone?: ToastTone; ttl?: number; action?: ToastAction } = {},
): number {
  const id = nextId++;
  // Toasts carrying a next-step link get longer to be read and clicked.
  const ttl = opts.ttl ?? (opts.action ? 6000 : 3500);
  items = [
    ...items,
    { id, tone: opts.tone ?? "success", message, ttl, action: opts.action },
  ];
  emit();
  return id;
}

export function dismissToast(id: number) {
  const next = items.filter((t) => t.id !== id);
  if (next.length !== items.length) {
    items = next;
    emit();
  }
}

// Two named cases the save paths fire. Errors linger longer than confirmations.
export function toastSaved(message = "Saved", opts: { action?: ToastAction } = {}) {
  return pushToast(message, { tone: "success", action: opts.action });
}
export function toastError(message: string) {
  return pushToast(message, { tone: "danger", ttl: 6000 });
}

// Test-only: reset between cases so the global counter/list don't leak.
export function clearAllToasts() {
  if (items.length > 0) {
    items = [];
    emit();
  }
}

// Read-only snapshot of the current stack (tests, debugging). UI code should
// subscribe via useToasts instead.
export function getToasts(): readonly ToastItem[] {
  return items;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function getSnapshot() {
  return items;
}

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
