"use client";

import { Languages } from "lucide-react";
import { useLocale } from "@/i18n/context";
import type { Locale } from "@/i18n/translations";
import { IconButton } from "@/components/ui/icon-button";

export function LocaleToggle() {
  const { locale, setLocale, t } = useLocale();

  const toggle = () => {
    const next: Locale = locale === "en" ? "zh" : "en";
    setLocale(next);
  };

  return (
    <IconButton
      onClick={toggle}
      aria-label={t("locale.toggle")}
    >
      <Languages className="h-4 w-4" strokeWidth={1.5} aria-hidden />
    </IconButton>
  );
}
