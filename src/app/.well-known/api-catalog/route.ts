import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/seo";

export function GET() {
  const catalog = {
    linkset: [
      {
        anchor: `${SITE_URL}/api/mcp`,
        "service-desc": [
          {
            href: `${SITE_URL}/api/mcp`,
            type: "application/json",
          },
        ],
        "service-doc": [
          {
            href: `${SITE_URL}/llms.txt`,
            type: "text/plain",
          },
        ],
        status: [
          {
            href: `${SITE_URL}/api/live`,
            type: "application/json",
          },
        ],
      },
    ],
  };

  return new NextResponse(JSON.stringify(catalog), {
    headers: {
      "Content-Type": "application/linkset+json",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
