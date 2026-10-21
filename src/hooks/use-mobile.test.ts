import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsMobile, useIsTablet } from "./use-mobile";

function BreakpointProbe() {
  return createElement("span", {
    "data-mobile": useIsMobile(),
    "data-tablet": useIsTablet(),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("responsive hydration snapshot", () => {
  it.each([390, 700, 900, 1440])("keeps the server snapshot independent of a %ipx browser", (innerWidth) => {
    vi.stubGlobal("window", { innerWidth });
    const html = renderToStaticMarkup(createElement(BreakpointProbe));
    expect(html).toContain('data-mobile="false"');
    expect(html).toContain('data-tablet="false"');
  });
});
