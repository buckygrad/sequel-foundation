import { describe, expect, it } from "vitest";
import { nextBackToTopState, type BackToTopState } from "../ui/back-to-top-state";

const VIEWPORT = 800;
const MIN_SCREENS = 2.5; // threshold = 2000px

const at = (y: number, visible = false): BackToTopState => ({ y, visible });

describe("nextBackToTopState", () => {
  it("stays hidden above the scroll threshold regardless of direction", () => {
    expect(nextBackToTopState(at(1500), 1000, VIEWPORT, MIN_SCREENS).visible).toBe(false);
    expect(nextBackToTopState(at(500), 1999, VIEWPORT, MIN_SCREENS).visible).toBe(false);
  });

  it("stays hidden while scrolling down past the threshold (reading direction)", () => {
    expect(nextBackToTopState(at(2400), 3000, VIEWPORT, MIN_SCREENS).visible).toBe(false);
  });

  it("appears when the user scrolls up past the threshold", () => {
    expect(nextBackToTopState(at(3000), 2900, VIEWPORT, MIN_SCREENS).visible).toBe(true);
  });

  it("hides again when the user resumes scrolling down", () => {
    const shown = nextBackToTopState(at(3000), 2900, VIEWPORT, MIN_SCREENS);
    expect(nextBackToTopState(shown, 3100, VIEWPORT, MIN_SCREENS).visible).toBe(false);
  });

  it("hides when an upward scroll crosses back above the threshold", () => {
    const shown = nextBackToTopState(at(2200), 2100, VIEWPORT, MIN_SCREENS);
    expect(shown.visible).toBe(true);
    expect(nextBackToTopState(shown, 1900, VIEWPORT, MIN_SCREENS).visible).toBe(false);
  });

  it("ignores sub-jitter movement in either direction", () => {
    const shown = nextBackToTopState(at(3000), 2900, VIEWPORT, MIN_SCREENS);
    expect(nextBackToTopState(shown, 2901, VIEWPORT, MIN_SCREENS).visible).toBe(true);
    const hidden = at(3000, false);
    expect(nextBackToTopState(hidden, 2999, VIEWPORT, MIN_SCREENS).visible).toBe(false);
  });

  it("tracks y so consecutive small deltas accumulate correctly", () => {
    let s = at(3000);
    s = nextBackToTopState(s, 2950, VIEWPORT, MIN_SCREENS);
    s = nextBackToTopState(s, 2905, VIEWPORT, MIN_SCREENS);
    expect(s).toMatchObject({ y: 2905, visible: true });
  });
});
