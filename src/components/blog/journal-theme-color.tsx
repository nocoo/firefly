"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { syncThemeColorMeta, themeColorFor } from "@/lib/theme-color";

/** The public route owns its browser chrome; unmount restores the admin theme. */
export function JournalThemeColor() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    syncThemeColorMeta(resolvedTheme === "dark" ? "#1e2824" : "#f0f0e9");
    return () => syncThemeColorMeta(themeColorFor(resolvedTheme));
  }, [resolvedTheme]);
  return null;
}
