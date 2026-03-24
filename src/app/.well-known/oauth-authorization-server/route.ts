import { getOAuthMetadata } from "@/lib/mcp/oauth";
import { jsonResponse } from "@/lib/api";

export function GET() {
  const issuer = process.env.AUTH_URL ?? "http://localhost:3000";
  const metadata = getOAuthMetadata(issuer);

  const res = jsonResponse(metadata);
  res.headers.set("Cache-Control", "public, max-age=3600");
  return res;
}
