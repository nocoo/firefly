import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/seo";

export function GET() {
  const catalog = {
    entries: [
      {
        title: "Firefly MCP API",
        description: "Model Context Protocol server for blog content management",
        url: `${SITE_URL}/api/mcp`,
        type: "application/json",
      },
      {
        title: "Firefly LLM Content",
        description: "LLM-readable blog content index",
        url: `${SITE_URL}/llms.txt`,
        type: "text/plain",
      },
    ],
  };

  return NextResponse.json(catalog, {
    headers: {
      "Cache-Control": "public, max-age=86400",
    },
  });
}
