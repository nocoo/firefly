import { describe, it, expect } from "vitest";
import {
  THEME_COLOR_DARK,
  THEME_COLOR_LIGHT,
  syncThemeColorMeta,
  themeColorFor,
} from "./theme-color";

describe("themeColorFor", () => {
  it("returns the light accent for light / system / unknown", () => {
    expect(themeColorFor("light")).toBe(THEME_COLOR_LIGHT);
    expect(themeColorFor("system")).toBe(THEME_COLOR_LIGHT);
    expect(themeColorFor(undefined)).toBe(THEME_COLOR_LIGHT);
  });

  it("returns the dark accent for dark", () => {
    expect(themeColorFor("dark")).toBe(THEME_COLOR_DARK);
  });
});

describe("syncThemeColorMeta", () => {
  it("creates a theme-color meta when none exist", () => {
    const appended: { name: string; content: string }[] = [];
    const doc = {
      querySelectorAll: () => [],
      createElement: () => {
        const attrs: Record<string, string> = {};
        return {
          setAttribute(name: string, value: string) {
            attrs[name] = value;
          },
          get name() {
            return attrs.name;
          },
          get content() {
            return attrs.content;
          },
        };
      },
      head: {
        appendChild(el: { name: string; content: string }) {
          appended.push({ name: el.name, content: el.content });
        },
      },
    };
    syncThemeColorMeta("#1348dc", doc as unknown as Document);
    expect(appended).toEqual([{ name: "theme-color", content: "#1348dc" }]);
  });

  it("updates every existing theme-color meta", () => {
    const a = { content: "#aaa", setAttribute(name: string, value: string) { if (name === "content") this.content = value; } };
    const b = { content: "#bbb", setAttribute(name: string, value: string) { if (name === "content") this.content = value; } };
    const doc = {
      querySelectorAll: () => [a, b],
      createElement: () => { throw new Error("should not create"); },
      head: { appendChild: () => { throw new Error("should not append"); } },
    };
    syncThemeColorMeta("#6f98f0", doc as unknown as Document);
    expect(a.content).toBe("#6f98f0");
    expect(b.content).toBe("#6f98f0");
  });
});
