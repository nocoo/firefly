"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useLocale } from "@/i18n/context";

type Theme = "light" | "dark" | "system";

const ICON_PROPS = {
  className: "h-4 w-4",
  strokeWidth: 1.5,
  "aria-hidden": true as const,
};

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("theme") as Theme) ?? "system";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    // system
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

// Subscribe to OS theme changes
function subscribeToMediaQuery(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getOsDarkSnapshot(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getOsDarkServerSnapshot(): boolean {
  return false;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const { t } = useLocale();

  // Re-apply when OS preference changes
  const osDark = useSyncExternalStore(
    subscribeToMediaQuery,
    getOsDarkSnapshot,
    getOsDarkServerSnapshot,
  );

  // Apply theme whenever theme or OS preference changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme, osDark]);

  const cycleTheme = () => {
    const order: Theme[] = ["system", "light", "dark"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    localStorage.setItem("theme", next);
  };

  const label =
    theme === "system"
      ? t("theme.system")
      : theme === "light"
        ? t("theme.light")
        : t("theme.dark");

  return (
    <button
      onClick={cycleTheme}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      aria-label={t("theme.toggle", { label })}
    >
      {theme === "system" ? (
        <Monitor {...ICON_PROPS} />
      ) : theme === "dark" ? (
        <Moon {...ICON_PROPS} />
      ) : (
        <Sun {...ICON_PROPS} />
      )}
    </button>
  );
}
