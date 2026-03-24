// ---------------------------------------------------------------------------
// Logo URL helpers — server-only
//
// This module depends on r2-client.ts (reads R2_PUBLIC_URL env var) and must
// NOT be imported by client components. Client components receive pre-computed
// logo URLs as props from their parent server components.
// ---------------------------------------------------------------------------

import { getR2PublicUrl } from "./r2-client";

const LOGO_BASE_PATH = "lizhengblog/wp-content/uploads/firefly/site";

export type LogoSize = 16 | 32 | 48 | 80 | 180 | 192 | 512;
export const LOGO_SIZES: LogoSize[] = [16, 32, 48, 80, 180, 192, 512];

/**
 * Build the public CDN URL for a logo variant.
 *
 * @example getLogoUrl("a1b2c3d4", 32)
 * // → "https://assets.lizheng.me/lizhengblog/wp-content/uploads/firefly/site/a1b2c3d4/logo-32.png"
 */
export function getLogoUrl(version: string, size: LogoSize): string {
  return `${getR2PublicUrl()}/${LOGO_BASE_PATH}/${version}/logo-${size}.png`;
}

/**
 * Build the R2 object key for a logo variant (no CDN prefix).
 */
export function getLogoR2Key(version: string, size: LogoSize): string {
  return `${LOGO_BASE_PATH}/${version}/logo-${size}.png`;
}
