// ---------------------------------------------------------------------------
// E2E-only: serve files from the local R2 filesystem directory.
//
// This route is gated by the same triple check as the R2 write adapter
// (E2E_R2_LOCAL_DIR + E2E_SKIP_AUTH + E2E_TEST_RUNNER). In production none
// of these env vars are set, so the route always returns 404.
//
// Path: /__e2e-r2/[...key]  (catch-all)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { isLocalE2EMode, resolveLocalR2Path } from "@/lib/e2e-local";

// Minimal MIME map — only the types firefly actually stores in R2.
const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  // Gate: never serve in production
  if (!isLocalE2EMode()) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { key: segments } = await params;
  const key = segments.join("/");

  let filePath: string;
  try {
    filePath = resolveLocalR2Path(key);
  } catch {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  try {
    const data = await readFile(filePath);
    const ext = extname(key).toLowerCase();
    const contentType = MIME_MAP[ext] ?? "application/octet-stream";
    return new NextResponse(data, {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }
    throw err;
  }
}
