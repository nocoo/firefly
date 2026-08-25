"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { syncThemeColorMeta, themeColorFor } from "@/lib/theme-color";

/** Keeps Safari status/address bar in sync with the resolved blog accent. */
export function ThemeColor() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    syncThemeColorMeta(themeColorFor(resolvedTheme));
  }, [resolvedTheme]);

  return null;
}
