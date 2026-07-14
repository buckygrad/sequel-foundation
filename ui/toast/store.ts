"use client";

import { useSyncExternalStore } from "react";

// Module-level toast store. Save paths call pushToast/toastSaved/toastError
// imperatively — they are plain functions, not hooks, so any code can fire a
// toast without threading a context through every editor. The single
// <ToastViewport> subscribes via useToasts() (useSyncExternalStore, per the
// repo convention over set-state-in-effect).

export type ToastTone = "success" | "info" | "danger";
export type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
  ttl: number;
};

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function pushToast(
  message: string,
  opts: { tone?: ToastTone; ttl?: number } = {},
): number {
  const id = nextId++;
  items = [
    ...items,
    { id, tone: opts.tone ?? "success", message, ttl: opts.ttl ?? 3500 },
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
export function toastSaved(message = "Saved") {
  return pushToast(message, { tone: "success" });
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
