import { jsonResponse } from "@/lib/api";

export function GET() {
  const issuer = process.env.AUTH_URL ?? "http://localhost:3000";
  const metadata = {
    resource: issuer,
    authorization_servers: [issuer],
    scopes_supported: ["full", "author"],
  };
  const res = jsonResponse(metadata);
  res.headers.set("Cache-Control", "public, max-age=3600");
  return res;
}
