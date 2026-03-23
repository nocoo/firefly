"use client";

import { Languages } from "lucide-react";
import { useLocale } from "@/i18n/context";
import type { Locale } from "@/i18n/translations";

export function LocaleToggle() {
  const { locale, setLocale, t } = useLocale();

  const toggle = () => {
    const next: Locale = locale === "en" ? "zh" : "en";
    setLocale(next);
  };

  return (
    <button
      onClick={toggle}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      aria-label={t("locale.toggle")}
    >
      <Languages className="h-4 w-4" strokeWidth={1.5} aria-hidden />
    </button>
  );
}
