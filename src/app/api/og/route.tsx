import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

/**
 * GET /api/og — generate a 1200×630 social card (PNG) for any post.
 *
 * Query params:
 *   - title: post title (required)
 *   - subtitle: optional secondary line (e.g. siteName, date, category)
 *
 * Falls back to a neutral cream card with the title typeset large. We avoid
 * shipping arbitrary fonts here — `next/og` ships system Roboto/Noto subsets
 * that cover Latin + CJK well enough for the typical post title.
 *
 * Cached aggressively at the edge: titles change rarely, and the URL itself
 * is the cache key (CDN immutable per query string).
 */
export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get("title") ?? "").slice(0, 200);
  const subtitle = (searchParams.get("subtitle") ?? "").slice(0, 80);

  const safeTitle = title || "Untitled";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background: "#f5f4f3",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Top: subtitle / context line */}
        {subtitle ? (
          <div
            style={{
              fontSize: 28,
              color: "#5c574a",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {subtitle}
          </div>
        ) : (
          <div />
        )}

        {/* Center: title — large, balanced */}
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.15,
            color: "#1a1a1a",
            letterSpacing: "-0.02em",
          }}
        >
          {safeTitle}
        </div>

        {/* Bottom: brand strip with accent dot */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 24,
            color: "#5c574a",
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: "#1d4ed8",
            }}
          />
          firefly
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      // Cache for a year — the OG image of a given (title, subtitle) tuple
      // is content-addressed; if we change the template we ship a new query.
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
      },
    },
  );
}
