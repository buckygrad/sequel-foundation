import type { ReactNode } from "react";

// Presentational toast chip. The orchestration layer (module-level store +
// auto-dismiss + the fixed bottom-right stack) lives in ./toast; keeping the
// chip pure means it stays unit-testable and the viewport just positions
// instances of it.

export type ToastTone = "success" | "info" | "danger";

const TONES: Record<ToastTone, { box: string; icon: string }> = {
  success: { box: "bg-emerald-600 text-white", icon: "✓" },
  info: { box: "bg-brand text-white", icon: "ℹ️" },
  danger: { box: "bg-red-600 text-white", icon: "⚠️" },
};

export function Toast({
  tone = "success",
  message,
  onDismiss,
}: {
  tone?: ToastTone;
  message: ReactNode;
  onDismiss?: () => void;
}) {
  const t = TONES[tone];
  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium shadow-lg ${t.box}`}
    >
      <span aria-hidden>{t.icon}</span>
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-1 text-white/80 hover:text-white"
        >
          ✕
        </button>
      )}
    </div>
  );
}
