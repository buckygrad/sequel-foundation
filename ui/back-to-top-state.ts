// Pure visibility reducer for ui/BackToTop.tsx, in its own .ts module so the
// node-environment unit suite can import it (tsconfig keeps jsx: preserve, so
// tests never import .tsx). Direction-aware with a small jitter band so
// trackpad noise doesn't strobe the pill.

const JITTER_PX = 2;

export type BackToTopState = { y: number; visible: boolean };

export function nextBackToTopState(
  prev: BackToTopState,
  y: number,
  viewportHeight: number,
  minScreens: number,
): BackToTopState {
  if (y <= viewportHeight * minScreens) return { y, visible: false };
  const delta = y - prev.y;
  if (delta < -JITTER_PX) return { y, visible: true };
  if (delta > JITTER_PX) return { y, visible: false };
  return { y, visible: prev.visible };
}
