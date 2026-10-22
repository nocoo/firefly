import { describe, it, expect, afterEach, vi } from "vitest";
import { isPodcastPostPreviewAllowed } from "./preview-gate";

describe("isPodcastPostPreviewAllowed", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows preview in non-production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("E2E_TEST_RUNNER", "");
    expect(isPodcastPostPreviewAllowed()).toBe(true);
  });

  it("blocks preview in production without e2e runner", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_TEST_RUNNER", "");
    expect(isPodcastPostPreviewAllowed()).toBe(false);
  });

  it("allows preview in production e2e runner", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_TEST_RUNNER", "true");
    expect(isPodcastPostPreviewAllowed()).toBe(true);
  });
});
