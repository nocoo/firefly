import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TraksAnalytics } from "./traks-analytics";

describe("TraksAnalytics", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.E2E_TEST_RUNNER;
  });

  afterEach(() => {
    if (saved === undefined) {
      Reflect.deleteProperty(process.env, "E2E_TEST_RUNNER");
    } else {
      process.env.E2E_TEST_RUNNER = saved;
    }
  });

  it("includes the collector script when not in the E2E harness", () => {
    Reflect.deleteProperty(process.env, "E2E_TEST_RUNNER");
    const html = renderToStaticMarkup(createElement(TraksAnalytics));
    expect(html).toContain("track-collect.nocoo.cloud");
  });

  it("renders nothing when E2E_TEST_RUNNER is set so L3 can reach networkidle", () => {
    process.env.E2E_TEST_RUNNER = "true";
    const html = renderToStaticMarkup(createElement(TraksAnalytics));
    expect(html).toBe("");
  });
});
