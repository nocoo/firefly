// Unit tests exercise data and mutation wiring without a Next request context.
// Real cross-request caching and invalidation are covered by API E2E.
export const unstable_cache = <T extends (...args: never[]) => unknown>(load: T): T => load;
export function revalidateTag(): void {
  // Framework effects are exercised by the real Next.js E2E server.
}
