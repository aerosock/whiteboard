import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type ThemeMode = "system" | "light" | "warm" | "charcoal" | "dark";
export type EffectiveTheme = "light" | "warm" | "charcoal" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  effectiveTheme: EffectiveTheme;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  setMode: () => {},
  effectiveTheme: "light",
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("wb-theme-mode") as ThemeMode | null;
    if (
      saved === "system" ||
      saved === "light" ||
      saved === "warm" ||
      saved === "charcoal" ||
      saved === "dark"
    ) {
      return saved;
    }
    return "system";
  });

  const [systemIsDark, setSystemIsDark] = useState(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Listen for system theme changes
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  const effectiveTheme: EffectiveTheme =
    mode === "system" ? (systemIsDark ? "dark" : "light") : mode;

  useEffect(() => {
    const isDarkLike = effectiveTheme === "dark" || effectiveTheme === "charcoal";
    document.documentElement.classList.toggle("dark", isDarkLike);
    document.documentElement.setAttribute("data-theme", effectiveTheme);
  }, [effectiveTheme]);

  function setMode(newMode: ThemeMode) {
    setModeState(newMode);
    localStorage.setItem("wb-theme-mode", newMode);
  }

  return (
    <ThemeContext.Provider value={{ mode, setMode, effectiveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
