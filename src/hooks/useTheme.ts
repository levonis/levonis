import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "default" | "light" | "dark";

const THEME_KEY = "levo-theme";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "default";
    return (localStorage.getItem(THEME_KEY) as ThemeMode) || "default";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-default", "theme-light", "theme-dark");
    root.classList.add(`theme-${theme}`);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);

  return { theme, setTheme };
}
