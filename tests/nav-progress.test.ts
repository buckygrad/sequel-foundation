import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clickStartsNavigation,
  endNavProgress,
  getNavProgress,
  resetNavProgress,
  startNavProgress,
  type NavClickInfo,
} from "../ui/nav-progress";

beforeEach(() => {
  vi.useFakeTimers();
  resetNavProgress();
});

afterEach(() => {
  resetNavProgress();
  vi.useRealTimers();
});

describe("nav-progress store", () => {
  it("start moves idle → active and bumps the generation", () => {
    expect(getNavProgress().phase).toBe("idle");
    startNavProgress();
    expect(getNavProgress()).toMatchObject({ phase: "active", generation: 1 });
  });

  it("a second start while active bumps the generation again (crawl restarts)", () => {
    startNavProgress();
    vi.advanceTimersByTime(500);
    startNavProgress();
    expect(getNavProgress()).toMatchObject({ phase: "active", generation: 2 });
  });

  it("end after a perceptible wait shows the done flash, then returns to idle", () => {
    startNavProgress();
    vi.advanceTimersByTime(1000);
    endNavProgress();
    expect(getNavProgress().phase).toBe("done");
    vi.advanceTimersByTime(300);
    expect(getNavProgress().phase).toBe("idle");
  });

  it("end within the show delay skips the done flash entirely", () => {
    startNavProgress();
    vi.advanceTimersByTime(100);
    endNavProgress();
    expect(getNavProgress().phase).toBe("idle");
  });

  it("end is a no-op when idle", () => {
    endNavProgress();
    expect(getNavProgress()).toMatchObject({ phase: "idle", generation: 0 });
  });

  it("a start that never completes self-clears via the fail-safe", () => {
    startNavProgress();
    vi.advanceTimersByTime(15_000);
    expect(getNavProgress().phase).toBe("idle");
  });

  it("a new start cancels a pending done fade", () => {
    startNavProgress();
    vi.advanceTimersByTime(1000);
    endNavProgress();
    startNavProgress();
    vi.advanceTimersByTime(300);
    expect(getNavProgress().phase).toBe("active");
  });
});

const base: NavClickInfo = {
  href: "/playbook/abc",
  targetAttr: null,
  hasDownload: false,
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  defaultPrevented: false,
  currentHref: "https://hub.example.com/",
};

describe("clickStartsNavigation", () => {
  it("accepts a plain internal link click", () => {
    expect(clickStartsNavigation(base)).toBe(true);
  });

  it("resolves relative hrefs against the current page", () => {
    expect(
      clickStartsNavigation({
        ...base,
        href: "phase/2",
        currentHref: "https://hub.example.com/playbook/abc/",
      }),
    ).toBe(true);
  });

  it("rejects cross-origin and non-http destinations", () => {
    expect(clickStartsNavigation({ ...base, href: "https://elsewhere.com/x" })).toBe(false);
    expect(clickStartsNavigation({ ...base, href: "mailto:a@b.com" })).toBe(false);
  });

  it("rejects modified and non-primary clicks (new-tab gestures)", () => {
    expect(clickStartsNavigation({ ...base, metaKey: true })).toBe(false);
    expect(clickStartsNavigation({ ...base, ctrlKey: true })).toBe(false);
    expect(clickStartsNavigation({ ...base, shiftKey: true })).toBe(false);
    expect(clickStartsNavigation({ ...base, button: 1 })).toBe(false);
  });

  it("rejects downloads, new-window targets, and prevented defaults", () => {
    expect(clickStartsNavigation({ ...base, hasDownload: true })).toBe(false);
    expect(clickStartsNavigation({ ...base, targetAttr: "_blank" })).toBe(false);
    expect(clickStartsNavigation({ ...base, defaultPrevented: true })).toBe(false);
  });

  it("accepts an explicit _self target", () => {
    expect(clickStartsNavigation({ ...base, targetAttr: "_self" })).toBe(true);
  });

  it("rejects hash-only jumps and re-clicks of the current page", () => {
    expect(
      clickStartsNavigation({
        ...base,
        href: "#board-report",
        currentHref: "https://hub.example.com/projects/9",
      }),
    ).toBe(false);
    expect(
      clickStartsNavigation({
        ...base,
        href: "/projects/9",
        currentHref: "https://hub.example.com/projects/9",
      }),
    ).toBe(false);
  });

  it("accepts a search-param change on the same path (tabs are URLs)", () => {
    expect(
      clickStartsNavigation({
        ...base,
        href: "/projects/9?tab=risks",
        currentHref: "https://hub.example.com/projects/9",
      }),
    ).toBe(true);
  });

  it("rejects a missing or malformed href", () => {
    expect(clickStartsNavigation({ ...base, href: null })).toBe(false);
    expect(clickStartsNavigation({ ...base, href: "/x", currentHref: "not a url" })).toBe(false);
  });
});
