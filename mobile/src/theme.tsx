import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Appearance } from "react-native";

export interface Palette {
  bg: string;
  card: string;
  text: string;
  muted: string;
  primary: string;
  primarySoft: string;
  border: string;
  danger: string;
  dangerBg: string;
  warning: string;
  warningBg: string;
  success: string;
  successBg: string;
  flag: string;
  tab: string;
}

const light: Palette = {
  bg: "#F4F2FA",
  card: "#FFFFFF",
  text: "#1C1730",
  muted: "#6B657A",
  primary: "#4338CA",
  primarySoft: "#EEF2FF",
  border: "#E4E1EE",
  danger: "#B91C1C",
  dangerBg: "#FEE2E2",
  warning: "#B45309",
  warningBg: "#FEF3C7",
  success: "#047857",
  successBg: "#D1FAE5",
  flag: "#D97706",
  tab: "#E7E4F2",
};

const dark: Palette = {
  bg: "#12121A",
  card: "#1C1C27",
  text: "#F4F4F5",
  muted: "#A1A1AA",
  primary: "#A5B4FC",
  primarySoft: "#1E1B4B",
  border: "#2E2E3A",
  danger: "#FCA5A5",
  dangerBg: "#450A0A",
  warning: "#FCD34D",
  warningBg: "#451A03",
  success: "#6EE7B7",
  successBg: "#022C22",
  flag: "#FBBF24",
  tab: "#2A2A36",
};

export const shadow = {
  shadowColor: "#000000",
  shadowOpacity: 0.08,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

type Choice = "light" | "dark" | "system";

interface ThemeValue {
  colors: Palette;
  scheme: "light" | "dark";
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);
const STORAGE_KEY = "xevra-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<Choice>("system");
  const [system, setSystem] = useState<"light" | "dark">(Appearance.getColorScheme() === "dark" ? "dark" : "light");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === "light" || saved === "dark") setChoice(saved);
    });
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystem(colorScheme === "dark" ? "dark" : "light");
    });
    return () => sub.remove();
  }, []);

  const scheme: "light" | "dark" = choice === "system" ? system : choice;
  const toggle = useCallback(() => {
    const next = scheme === "dark" ? "light" : "dark";
    setChoice(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, [scheme]);

  const value = useMemo<ThemeValue>(
    () => ({ colors: scheme === "dark" ? dark : light, scheme, toggle }),
    [scheme, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

export function useColors(): Palette {
  return useTheme().colors;
}
