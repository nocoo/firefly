"use client";

import { useTheme } from "next-themes";

function ThemeMark({ name }: { name: "sun" | "moon" }) {
  return (
    <svg
      className={name === "sun" ? "theme-sun" : "theme-moon"}
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === "sun" ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
        </>
      ) : (
        <path d="M20.5 14a8.5 8.5 0 0 1-10.5-10.5A8.5 8.5 0 1 0 20.5 14Z" />
      )}
    </svg>
  );
}

export function JournalThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const label = isDark ? "主题：深色；切换为浅色" : "主题：浅色；切换为深色";

  return (
    <button
      type="button"
      className="journal-theme-toggle"
      aria-label={label}
      title={label}
      suppressHydrationWarning
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <ThemeMark name="sun" />
      <ThemeMark name="moon" />
    </button>
  );
}
