"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "moneymap-theme";

interface ThemeSnapshot {
  theme: Theme;
  systemTheme: ResolvedTheme;
}

const SERVER_SNAPSHOT: ThemeSnapshot = { theme: "system", systemTheme: "dark" };

let snapshot: ThemeSnapshot = { ...SERVER_SNAPSHOT };
const listeners = new Set<() => void>();

function readSnapshot(): ThemeSnapshot {
  let theme: Theme = "system";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") theme = stored;
  const systemTheme: ResolvedTheme =
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  if (snapshot.theme !== theme || snapshot.systemTheme !== systemTheme) {
    snapshot = { theme, systemTheme };
  }
  return snapshot;
}

function subscribeThemeStore(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  listeners.add(callback);
  window.addEventListener("storage", callback);
  mq.addEventListener("change", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
    mq.removeEventListener("change", callback);
  };
}

function setTheme(next: Theme) {
  localStorage.setItem(THEME_STORAGE_KEY, next);
  readSnapshot();
  listeners.forEach((listener) => listener());
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, systemTheme } = useSyncExternalStore(
    subscribeThemeStore,
    readSnapshot,
    () => SERVER_SNAPSHOT,
  );

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}