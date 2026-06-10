"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Thin client wrapper around `next-themes`'s ThemeProvider.
 *
 * Importing `next-themes` directly inside the root server component triggers
 * a React 19 / Next 16 dev warning ("Scripts inside React components are
 * never executed when rendering on the client") because next-themes injects
 * an inline `<script>` to read the persisted theme before hydration. The
 * warning is benign at runtime, but the script-injection path interacts
 * badly with StrictMode double-mount and can leave the page un-hydrated on
 * routes that throw during initial render (e.g. /admin/system when the
 * memory API errors). Wrapping in a "use client" boundary keeps the script
 * injection on the client side where it belongs and silences the warning.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
