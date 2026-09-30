import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocales, type Locale as DeviceLocale } from "expo-localization";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { L10n, Locale } from "../types";
import { STRINGS, type StringKey } from "./strings";

/** "system" follows the device; "da" or "en" pins the app to one language. */
export type LocalePref = "system" | Locale;

type I18nValue = {
  /** The language the app is showing right now. */
  locale: Locale;
  /** What the person picked in settings. */
  pref: LocalePref;
  setPref: (p: LocalePref) => void;
  /** Look up a string by key. */
  t: (key: StringKey) => string;
  /** Read one side of an { da, en } pair that came from the catalogue. */
  l: (value: L10n) => string;
};

/* v2: v1 stored a pinned language as soon as anyone tapped a chip, which
   left no way back to following the device. Starting over on a new key
   puts everyone on "system". */
const KEY = "odatone.locale.v2";
const Ctx = createContext<I18nValue | null>(null);

/** The first of the device's preferred languages that the app speaks.
 *  Danish when none of them is Danish or English. */
function deviceLocale(locales: DeviceLocale[]): Locale {
  for (const l of locales) {
    if (l.languageCode === "da" || l.languageCode === "en") return l.languageCode;
  }
  return "da";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  /* Re-renders when the device language changes, so "system" follows along
     without a restart. */
  const device = deviceLocale(useLocales());
  const [pref, setPrefState] = useState<LocalePref>("system");
  const locale = pref === "system" ? device : pref;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === "da" || v === "en") setPrefState(v);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      pref,
      setPref: (p) => {
        setPrefState(p);
        (p === "system" ? AsyncStorage.removeItem(KEY) : AsyncStorage.setItem(KEY, p)).catch(() => {});
      },
      t: (key) => STRINGS[key][locale],
      l: (value) => value[locale],
    }),
    [locale, pref],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside <I18nProvider>");
  return v;
}
