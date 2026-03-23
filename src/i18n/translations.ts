import en from "./locales/en.json";
import zh from "./locales/zh.json";

const messages: Record<string, Record<string, string>> = { en, zh };

export type Locale = "en" | "zh";
export const DEFAULT_LOCALE: Locale = "zh";
export const LOCALES: Locale[] = ["en", "zh"];

/**
 * Translate a key with optional interpolation.
 *
 * @example t("en", "blog.footer.copyright", { year: 2026 })
 */
export function t(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  let text = messages[locale]?.[key] ?? messages[DEFAULT_LOCALE]?.[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
