import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import { DARK, LIGHT, type Palette } from "./tokens";

export type ThemeMode = "system" | "light" | "dark";

type ThemeValue = {
  c: Palette;
  /** What is actually on screen right now. */
  scheme: "light" | "dark";
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
};

const KEY = "odatone.theme.v1";
const Ctx = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === "light" || v === "dark" || v === "system") setModeState(v);
      })
      .catch(() => {
        /* first run, or storage unavailable — the default is fine */
      });
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme: "light" | "dark" = mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
    return {
      c: scheme === "dark" ? DARK : LIGHT,
      scheme,
      mode,
      setMode: (m) => {
        setModeState(m);
        AsyncStorage.setItem(KEY, m).catch(() => {});
      },
    };
  }, [mode, system]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme must be used inside <ThemeProvider>");
  return v;
}
