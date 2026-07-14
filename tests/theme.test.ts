import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME_STORAGE_KEY,
  THEME_MODES,
  isThemeMode,
  nextThemeMode,
  resolveTheme,
  themeInitScript,
} from "../theme/theme";

describe("resolveTheme", () => {
  it("passes explicit modes through", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
  it("follows the browser preference in system mode", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("nextThemeMode", () => {
  it("cycles Light → Dark → System → Light", () => {
    expect(nextThemeMode("light")).toBe("dark");
    expect(nextThemeMode("dark")).toBe("system");
    expect(nextThemeMode("system")).toBe("light");
  });
});

describe("isThemeMode", () => {
  it("accepts the three modes and rejects everything else", () => {
    for (const m of THEME_MODES) expect(isThemeMode(m)).toBe(true);
    expect(isThemeMode("auto")).toBe(false);
    expect(isThemeMode(null)).toBe(false);
  });
});

describe("themeInitScript", () => {
  it("embeds the given storage key (and only stamps light/dark)", () => {
    const script = themeInitScript("myapp.theme");
    expect(script).toContain('"myapp.theme"');
    expect(script).toContain("dataset.theme");
  });
  it("defaults to the shared key", () => {
    expect(themeInitScript()).toContain(JSON.stringify(DEFAULT_THEME_STORAGE_KEY));
  });
});
