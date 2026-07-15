import { type NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getPostBySlug } from "@/data/entities/post";
import { SITE_URL, postPath, formatDateISO } from "@/lib/seo";

interface Params {
  year: string;
  month: string;
  slug: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { year, month, slug } = await params;
  const db = getDb();
  const post = await getPostBySlug(db, slug, "published");

  if (!post) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Validate year/month match the published date (same logic as page.tsx)
  if (post.published_at) {
    const d = new Date(post.published_at * 1000);
    const expectedYear = String(d.getFullYear());
    const expectedMonth = String(d.getMonth() + 1).padStart(2, "0");
    if (year !== expectedYear || month !== expectedMonth) {
      return new NextResponse("Not found", { status: 404 });
    }
  }

  // Build markdown with metadata header
  const lines: string[] = [];
  lines.push(`# ${post.title}`);
  lines.push("");
  if (post.excerpt) {
    lines.push(`> ${post.excerpt}`);
    lines.push("");
  }

  const meta: string[] = [];
  if (post.published_at) meta.push(`Date: ${formatDateISO(post.published_at)}`);
  if (post.category_name) meta.push(`Category: ${post.category_name}`);
  const url = SITE_URL + postPath(post.slug, post.published_at);
  meta.push(`URL: ${url}`);
  if (meta.length) {
    lines.push(meta.join(" | "));
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  lines.push(post.content);

  const markdown = lines.join("\n");
  const tokenEstimate = Math.ceil(markdown.length / 4);

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "x-markdown-tokens": String(tokenEstimate),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
