"use client";

import {
  createContext,
  useContext,
  useCallback,
} from "react";
import { t as translate, type Locale, DEFAULT_LOCALE } from "./translations";

interface LocaleContextValue {
  locale: Locale;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  t: (key) => key,
});

export function LocaleProvider({
  locale: initial,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(initial, key, params),
    [initial],
  );

  return (
    <LocaleContext value={{ locale: initial, t }}>
      {children}
    </LocaleContext>
  );
}

export const useLocale = () => useContext(LocaleContext);
