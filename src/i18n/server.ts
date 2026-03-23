import { cookies } from "next/headers";
import { DEFAULT_LOCALE, type Locale, LOCALES } from "./translations";

/**
 * Read the user's locale preference from the cookie (server-side).
 */
export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("locale")?.value;
  return LOCALES.includes(raw as Locale) ? (raw as Locale) : DEFAULT_LOCALE;
}
