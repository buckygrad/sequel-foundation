"use client";

import { useEffect } from "react";
import { Toast } from "../Toast";
import { dismissToast, useToasts, type ToastItem } from "./store";

// Single global toast stack, mounted once in the root layout. Each toast
// auto-dismisses after its ttl; the user can dismiss early. Fixed bottom-right,
// above app chrome.
export function ToastViewport() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <AutoDismiss key={t.id} item={t} />
      ))}
    </div>
  );
}

function AutoDismiss({ item }: { item: ToastItem }) {
  useEffect(() => {
    const h = setTimeout(() => dismissToast(item.id), item.ttl);
    return () => clearTimeout(h);
  }, [item.id, item.ttl]);
  return (
    <Toast
      tone={item.tone}
      message={item.message}
      onDismiss={() => dismissToast(item.id)}
    />
  );
}
