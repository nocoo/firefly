"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";

const ICON_PROPS = {
  className: "h-4 w-4",
  strokeWidth: 1.5,
  "aria-hidden": true as const,
};

const noop = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

/** SSR-safe mounted flag — false on server, true after hydration */
function useMounted(): boolean {
  return useSyncExternalStore(noop, getTrue, getFalse);
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const cycleTheme = () => {
    const order = ["system", "light", "dark"] as const;
    const current = theme ?? "system";
    const next = order[(order.indexOf(current as typeof order[number]) + 1) % order.length];
    setTheme(next);
  };

  const label =
    theme === "light"
      ? "浅色"
      : theme === "dark"
        ? "深色"
        : "跟随系统";

  // Render a static placeholder until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <IconButton aria-label={`切换主题（当前：跟随系统）`}>
        <Monitor {...ICON_PROPS} />
      </IconButton>
    );
  }

  return (
    <IconButton
      onClick={cycleTheme}
      aria-label={`切换主题（当前：${label}）`}
    >
      {theme === "dark" ? (
        <Moon {...ICON_PROPS} />
      ) : theme === "light" ? (
        <Sun {...ICON_PROPS} />
      ) : (
        <Monitor {...ICON_PROPS} />
      )}
    </IconButton>
  );
}
