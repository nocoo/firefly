/** Dev / E2E-only preview routes (never public production). */

export function isPodcastPostPreviewAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.E2E_TEST_RUNNER === "true";
}
