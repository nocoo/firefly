/**
 * L3 BDD: URL for the shared test JPEG used in inline markdown images.
 *
 * When `R2_PUBLIC_URL` points at the local `__e2e-r2` read route, the image
 * must be requested under that path (same as production R2 keys). Older specs
 * used `${origin}/wp-content/...`, which 404s once `/_next/image` fetches it.
 */
export function e2eBddTestImageUrl(
  envR2Public = process.env.R2_PUBLIC_URL,
): string {
  const fallback = "https://assets.example.com/wp-content/uploads/test-e2e.jpg";
  if (!envR2Public) return fallback;
  try {
    if (envR2Public.includes("__e2e-r2")) {
      const base = envR2Public.replace(/\/$/, "");
      return `${base}/wp-content/uploads/test-e2e.jpg`;
    }
    return `${new URL(envR2Public).origin}/wp-content/uploads/test-e2e.jpg`;
  } catch {
    return fallback;
  }
}
