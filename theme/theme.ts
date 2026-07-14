// Theme model shared by all Sequel apps. Three-state Light / Dark / System per
// the enterprise norm: default follows the browser appearance setting
// (prefers-color-scheme), an explicit in-app toggle overrides it, the choice
// persists in localStorage, and an inline pre-hydration script stamps
// <html data-theme="…"> so there is never a flash of the wrong theme.
// Tailwind's `dark:` variant is re-keyed to the attribute in brand/theme.css,
// so the resolved theme — not the raw media query — drives every dark style.
//
// The storage key is per-app so two Sequel apps on the same host don't fight
// over one preference (Project Hub uses "pi.theme", the Acquisition Hub
// "hub.theme"). The stored mode value is always "system" for the auto mode so
// keys stay interchangeable if an app ever renames its key.

export const DEFAULT_THEME_STORAGE_KEY = "sequel.theme";

export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export function isThemeMode(v: unknown): v is ThemeMode {
  return typeof v === "string" && (THEME_MODES as readonly string[]).includes(v);
}

// The resolved (rendered) theme for a mode given the browser preference.
export function resolveTheme(mode: ThemeMode, systemDark: boolean): "light" | "dark" {
  if (mode === "system") return systemDark ? "dark" : "light";
  return mode;
}

// Toggle cycle: Light → Dark → System → Light.
export function nextThemeMode(mode: ThemeMode): ThemeMode {
  const i = THEME_MODES.indexOf(mode);
  return THEME_MODES[(i + 1) % THEME_MODES.length];
}

// The auto mode reads `prefers-color-scheme`, which is the BROWSER's appearance
// setting (it may override the OS) — so "System" would be a misnomer. Label it
// "Browser"; the stored mode value stays "system" so existing localStorage
// choices keep working.
export const THEME_MODE_LABEL: Record<ThemeMode, string> = {
  light: "Light",
  dark: "Dark",
  system: "Browser",
};

export const THEME_MODE_HINT: Record<ThemeMode, string> = {
  light: "Always light",
  dark: "Always dark",
  system: "Follows your browser's appearance setting",
};

// Inline, dependency-free, runs before first paint (rendered as the first
// element of <body>). Mirrors resolveTheme — keep the two in sync.
export function themeInitScript(storageKey: string = DEFAULT_THEME_STORAGE_KEY): string {
  return `(function(){try{var m=localStorage.getItem(${JSON.stringify(
    storageKey,
  )});if(m!=="light"&&m!=="dark")m="system";var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;
}

// Convenience for apps on the default key.
export const THEME_INIT_SCRIPT = themeInitScript();
