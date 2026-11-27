export type Theme = "dark" | "light";
const KEY = "ca_theme";
export function currentTheme(): Theme {
  try { const v = localStorage.getItem(KEY); if (v === "dark" || v === "light") return v; } catch { /* ignore */ }
  return "light"; // DXC brand: a warm, light space (Canvas) is the default; dark (Midnight Blue) is optional
}
export function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
}
