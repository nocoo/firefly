/**
 * Central version constant.
 *
 * Injected at build time via NEXT_PUBLIC_APP_VERSION (see next.config.ts).
 * Falls back to "0.0.0" if the env var is missing (e.g. in tests).
 */
export const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
