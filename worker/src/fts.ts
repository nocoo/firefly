/**
 * FTS5 full-text search module for the Cloudflare Worker.
 *
 * Provides:
 * - segmentText()       — CJK + Latin word segmentation via Intl.Segmenter
 * - sanitizeFtsQuery()  — Escape FTS5 special chars, build MATCH expression
 * - handleFtsSync()     — Upsert/delete a single post in the FTS index
 * - handleFtsRebuild()  — Rebuild the entire FTS index from posts table
 * - handleFtsSearch()   — Execute FTS5 search with BM25 ranking + snippets
 */

// ---------------------------------------------------------------------------
// Segmentation — Intl.Segmenter (V8 built-in, zero-dependency)
// ---------------------------------------------------------------------------

const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });

/**
 * Segment text into space-delimited tokens.
 * CJK words are split by the ICU dictionary; Latin words preserved whole.
 */
export function segmentText(text: string): string {
  if (!text) return "";
  return [...segmenter.segment(text)]
    .filter((s) => s.isWordLike)
    .map((s) => s.segment.toLowerCase())
    .join(" ");
}

// ---------------------------------------------------------------------------
// FTS5 query builder
// ---------------------------------------------------------------------------

/** Characters that have special meaning in FTS5 MATCH expressions. */
const FTS5_SPECIAL = /[":(){}^+\-~|]/g;

/**
 * Sanitize user input into a safe FTS5 MATCH expression.
 * Each segmented token is quoted; all tokens are ANDed.
 * Preserves trailing * for prefix matching.
 */
export function sanitizeFtsQuery(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Segment the query (same pipeline as indexing)
  const tokens = segmentText(trimmed).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return "";

  // Quote each token, preserving trailing * for prefix search
  return tokens
    .map((token) => {
      const hasStar = token.endsWith("*");
      const clean = (hasStar ? token.slice(0, -1) : token).replace(
        FTS5_SPECIAL,
        "",
      );
      if (!clean) return null;
      return hasStar ? `"${clean}"*` : `"${clean}"`;
    })
    .filter(Boolean)
    .join(" ");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FtsSyncBody {
  action: "upsert" | "delete";
  postId?: string;
  title?: string;
  content?: string;
  excerpt?: string;
  rowid?: number;
}

interface FtsSearchBody {
  query: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

interface FtsSearchResult {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  content_html: string;
  status: string;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  featured_image: string | null;
  reading_time: number;
  comment_count: number;
  view_count: number;
  comment_enabled: number;
  published_at: number | null;
  created_at: number;
  updated_at: number;
  reference_url: string | null;
  reference_title: string | null;
  reference_description: string | null;
  reference_image: string | null;
  search_snippet: string;
}

// ---------------------------------------------------------------------------
// POST /api/v1/fts-sync
// ---------------------------------------------------------------------------

export async function handleFtsSync(
  body: unknown,
  db: D1Database,
): Promise<Response> {
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { action, postId, title, content, excerpt, rowid } =
    body as FtsSyncBody;

  if (action === "delete") {
    if (rowid == null) {
      return Response.json(
        { error: "rowid is required for delete" },
        { status: 400 },
      );
    }
    await db
      .prepare("DELETE FROM posts_fts WHERE rowid = ?")
      .bind(rowid)
      .run();
    return Response.json({ ok: true, action: "delete", rowid });
  }

  if (action === "upsert") {
    if (!postId) {
      return Response.json(
        { error: "postId is required for upsert" },
        { status: 400 },
      );
    }

    // Segment text
    const segTitle = segmentText(title ?? "");
    const segContent = segmentText(content ?? "");
    const segExcerpt = segmentText(excerpt ?? "");

    // Get rowid from posts table
    const row = await db
      .prepare("SELECT rowid FROM posts WHERE id = ?")
      .bind(postId)
      .first<{ rowid: number }>();

    if (!row) {
      return Response.json(
        { error: `Post ${postId} not found` },
        { status: 404 },
      );
    }

    // Delete existing entry (if any) then insert
    await db.batch([
      db.prepare("DELETE FROM posts_fts WHERE rowid = ?").bind(row.rowid),
      db
        .prepare(
          "INSERT INTO posts_fts(rowid, title, content, excerpt) VALUES (?, ?, ?, ?)",
        )
        .bind(row.rowid, segTitle, segContent, segExcerpt),
    ]);

    return Response.json({ ok: true, action: "upsert", postId });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

// ---------------------------------------------------------------------------
// POST /api/v1/fts-rebuild
// ---------------------------------------------------------------------------

export async function handleFtsRebuild(db: D1Database): Promise<Response> {
  // Clear existing index
  await db.prepare("DELETE FROM posts_fts").run();

  // Fetch all posts
  const { results: posts } = await db
    .prepare("SELECT rowid, title, content, excerpt FROM posts")
    .all<{ rowid: number; title: string; content: string; excerpt: string }>();

  if (!posts || posts.length === 0) {
    return Response.json({ ok: true, indexed: 0 });
  }

  // Batch insert segmented text
  const stmts = posts.map((p) =>
    db
      .prepare(
        "INSERT INTO posts_fts(rowid, title, content, excerpt) VALUES (?, ?, ?, ?)",
      )
      .bind(
        p.rowid,
        segmentText(p.title),
        segmentText(p.content),
        segmentText(p.excerpt ?? ""),
      ),
  );

  // D1.batch() has a limit; chunk into batches of 50
  for (let i = 0; i < stmts.length; i += 50) {
    await db.batch(stmts.slice(i, i + 50));
  }

  return Response.json({ ok: true, indexed: posts.length });
}

// ---------------------------------------------------------------------------
// POST /api/v1/fts-search
// ---------------------------------------------------------------------------

export async function handleFtsSearch(
  body: unknown,
  db: D1Database,
): Promise<Response> {
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const {
    query,
    status = "published",
    page = 1,
    pageSize = 20,
  } = body as FtsSearchBody;

  if (!query || typeof query !== "string" || !query.trim()) {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  const matchExpr = sanitizeFtsQuery(query);
  if (!matchExpr) {
    return Response.json({
      posts: [],
      snippets: {},
      total: 0,
      page,
      pageSize,
    });
  }

  const offset = (page - 1) * pageSize;

  // Search with BM25 ranking: title × 10, content × 1, excerpt × 5
  const searchSql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug,
           snippet(posts_fts, -1, '<mark>', '</mark>', '…', 40) AS search_snippet
    FROM posts_fts
    JOIN posts p ON p.rowid = posts_fts.rowid
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE posts_fts MATCH ?
      AND p.status = ?
    ORDER BY bm25(posts_fts, 10.0, 1.0, 5.0), p.published_at DESC, p.rowid DESC
    LIMIT ? OFFSET ?
  `;

  const countSql = `
    SELECT COUNT(*) AS count
    FROM posts_fts
    JOIN posts p ON p.rowid = posts_fts.rowid
    WHERE posts_fts MATCH ?
      AND p.status = ?
  `;

  try {
    const [searchResult, countResult] = await Promise.all([
      db
        .prepare(searchSql)
        .bind(matchExpr, status, pageSize, offset)
        .all<FtsSearchResult>(),
      db
        .prepare(countSql)
        .bind(matchExpr, status)
        .first<{ count: number }>(),
    ]);

    const posts = searchResult.results ?? [];
    const snippets: Record<string, string> = {};

    const postsClean = posts.map((row) => {
      if (row.search_snippet) {
        snippets[row.id] = row.search_snippet;
      }
      // Remove search_snippet from post object
      const { search_snippet: _, ...post } = row;
      return post;
    });

    return Response.json({
      posts: postsClean,
      snippets,
      total: countResult?.count ?? posts.length,
      page,
      pageSize,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: `FTS search failed: ${message}` },
      { status: 500 },
    );
  }
}
