import { useState } from "react";
import type { Lang } from "@codigo-alta/shared";
import { applyTheme, currentTheme, type Theme } from "./theme";

export function ThemeToggle({ lang }: { lang: Lang }) {
  const [theme, setTheme] = useState<Theme>(currentTheme());
  const gl = lang === "gl";
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = next === "light" ? (gl ? "Tema claro" : "Tema claro") : (gl ? "Tema escuro" : "Tema oscuro");
  return <button className="ghost themebtn" aria-label={label} title={label} onClick={() => { applyTheme(next); setTheme(next); }}>{next === "light" ? "☀️" : "🌙"} {label}</button>;
}
