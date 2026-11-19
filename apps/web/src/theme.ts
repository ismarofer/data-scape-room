export type Theme = "dark" | "light";
const KEY = "ca_theme";
export function currentTheme(): Theme {
  try { const v = localStorage.getItem(KEY); if (v === "dark" || v === "light") return v; } catch { /* ignore */ }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
}
