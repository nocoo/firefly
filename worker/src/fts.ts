/**
 * FTS5 full-text search module for the Cloudflare Worker.
 *
 * Provides:
 * - segmentText()       — CJK + Latin word segmentation via Intl.Segmenter
 * - sanitizeFtsQuery()  — Escape FTS5 special chars, build MATCH expression
 * - handleFtsSync()     — Upsert/delete a single post in the FTS index
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
 *
 * Supports:
 * - Plain terms: segmented then ANDed as quoted tokens
 * - Quoted phrases: `"exact phrase"` preserved as FTS5 phrase query
 * - Prefix matching: `cloud*` preserved as FTS5 prefix query
 */
export function sanitizeFtsQuery(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const parts: string[] = [];

  // Extract quoted phrases first, then process remaining text
  const phraseRe = /"([^"]+)"/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  match = phraseRe.exec(trimmed);
  while (match !== null) {
    // Process unquoted text before this phrase
    const before = trimmed.slice(lastIndex, match.index).trim();
    if (before) parts.push(...tokenizeUnquoted(before));

    // Segment the phrase content, then wrap as a single FTS5 phrase
    const phraseTokens = segmentText(match[1])
      .split(/\s+/)
      .filter(Boolean);
    if (phraseTokens.length > 0) {
      parts.push(`"${phraseTokens.join(" ")}"`);
    }

    lastIndex = phraseRe.lastIndex;
    match = phraseRe.exec(trimmed);
  }

  // Process remaining unquoted text after the last phrase
  const tail = trimmed.slice(lastIndex).trim();
  if (tail) parts.push(...tokenizeUnquoted(tail));

  return parts.filter(Boolean).join(" ");
}

/**
 * Tokenize unquoted text into FTS5 terms.
 * Preserves trailing * on individual tokens for prefix search.
 */
function tokenizeUnquoted(text: string): string[] {
  // Split on whitespace to detect per-word trailing *
  const words = text.split(/\s+/).filter(Boolean);
  const result: string[] = [];

  for (const word of words) {
    const hasPrefix = word.endsWith("*");
    const raw = hasPrefix ? word.slice(0, -1) : word;

    // Segment each word (handles CJK compound words)
    const tokens = segmentText(raw).split(/\s+/).filter(Boolean);

    for (let i = 0; i < tokens.length; i++) {
      const clean = tokens[i].replace(FTS5_SPECIAL, "");
      if (!clean) continue;

      // Only the last token of a prefix word gets the *
      if (hasPrefix && i === tokens.length - 1) {
        result.push(`"${clean}"*`);
      } else {
        result.push(`"${clean}"`);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Clamp a numeric value to a safe positive integer with optional max. */
function clampPositive(value: number, fallback: number, max?: number): number {
  if (!Number.isFinite(value) || value < 1) return fallback;
  const clamped = Math.floor(value);
  return max ? Math.min(clamped, max) : clamped;
}

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
    status,
    page: rawPage = 1,
    pageSize: rawPageSize = 20,
  } = body as FtsSearchBody;

  // Clamp page/pageSize to safe positive integers
  const page = clampPositive(rawPage, 1);
  const pageSize = clampPositive(rawPageSize, 20, 100);

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

  // Build optional status filter clause
  const statusClause = status ? "AND p.status = ?" : "";

  // Search with BM25 ranking: title × 10, content × 1, excerpt × 5
  const searchSql = `
    SELECT p.*, c.name AS category_name, c.slug AS category_slug,
           snippet(posts_fts, -1, '<mark>', '</mark>', '…', 40) AS search_snippet
    FROM posts_fts
    JOIN posts p ON p.rowid = posts_fts.rowid
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE posts_fts MATCH ?
      ${statusClause}
    ORDER BY bm25(posts_fts, 10.0, 1.0, 5.0), p.published_at DESC, p.rowid DESC
    LIMIT ? OFFSET ?
  `;

  const countSql = `
    SELECT COUNT(*) AS count
    FROM posts_fts
    JOIN posts p ON p.rowid = posts_fts.rowid
    WHERE posts_fts MATCH ?
      ${statusClause}
  `;

  // Build bind params — status only included when filtering
  const searchParams = status
    ? [matchExpr, status, pageSize, offset]
    : [matchExpr, pageSize, offset];
  const countParams = status ? [matchExpr, status] : [matchExpr];

  try {
    const [searchResult, countResult] = await Promise.all([
      db
        .prepare(searchSql)
        .bind(...searchParams)
        .all<FtsSearchResult>(),
      db
        .prepare(countSql)
        .bind(...countParams)
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
