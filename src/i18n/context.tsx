"use client";

import {
  createContext,
  useContext,
  useCallback,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { t as translate, type Locale, DEFAULT_LOCALE } from "./translations";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => key,
});

export function LocaleProvider({
  locale: initial,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const setLocale = useCallback(
    (l: Locale) => {
      document.cookie = `locale=${l};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
      startTransition(() => router.refresh());
    },
    [router, startTransition],
  );

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(initial, key, params),
    [initial],
  );

  return (
    <LocaleContext value={{ locale: initial, setLocale, t }}>
      {children}
    </LocaleContext>
  );
}

export const useLocale = () => useContext(LocaleContext);
