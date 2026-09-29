import { THEMES } from "./constants";

const DEFAULT_THEME = "gold";

export function applyTheme(key) {
  const theme = THEMES.find((t) => t.key === key) || THEMES.find((t) => t.key === DEFAULT_THEME);
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute("data-theme", theme.key);
  return theme.key;
}

export function themeName(key) {
  return (THEMES.find((t) => t.key === key) || {}).name || "Royal Gold";
}
