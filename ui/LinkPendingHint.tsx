"use client";

import { useLinkStatus } from "next/link";

// Inline pending hint for high-traffic navigation tiles/links. Render INSIDE
// the <Link> whose transition it reports (useLinkStatus reads the enclosing
// Link's pending state):
//
//   <Link href="/vcp" className={buttonClasses(...)}>
//     Open VCP <LinkPendingHint />
//   </Link>
//
// Complements the global <NavProgress/> bar with feedback on the control the
// user actually clicked. Text, not a spinner glyph — same stance as Button's
// busy/busyLabel. The fade-in carries a ~250ms CSS delay (seq-fade-in-delayed
// in theme.css) so fast navigations never flicker.
export function LinkPendingHint({
  label = "Opening…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span role="status" className={`animate-seq-fade-in-delayed text-xs opacity-80 ${className}`}>
      {label}
    </span>
  );
}
