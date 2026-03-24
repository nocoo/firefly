/**
 * lizhengme Worker — Cloudflare Worker with native D1 binding.
 *
 * Single Worker handling both reads and writes for the Firefly blog.
 *
 * Routes:
 * - GET  /api/live     — health check (no auth)
 * - POST /api/query    — execute read-only SQL (regex guards writes)
 * - POST /api/execute  — execute write SQL (INSERT/UPDATE/DELETE)
 *
 * Auth: Bearer WORKER_SECRET on /api/query and /api/execute.
 */

const WORKER_VERSION = "1.0.0";

const bootTime = Date.now();

export interface Env {
  DB: D1Database;
  WORKER_SECRET: string;
}

const WRITE_RE = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|PRAGMA)\b/i;

// ---------------------------------------------------------------------------
// GET /api/live
// ---------------------------------------------------------------------------

async function handleLive(env: Env): Promise<Response> {
  let dbStatus: { connected: boolean; latencyMs?: number; error?: string };

  try {
    const start = performance.now();
    await env.DB.prepare("SELECT 1").first();
    dbStatus = {
      connected: true,
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    dbStatus = {
      connected: false,
      error: message.replace(/\bok\b/gi, "***"),
    };
  }

  const isHealthy = dbStatus.connected;

  return Response.json(
    {
      status: isHealthy ? "ok" : "error",
      version: WORKER_VERSION,
      uptime: Math.round((Date.now() - bootTime) / 1000),
      db: dbStatus,
      timestamp: new Date().toISOString(),
    },
    {
      status: isHealthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

// ---------------------------------------------------------------------------
// POST /api/query — read-only SQL
// ---------------------------------------------------------------------------

async function handleQuery(body: unknown, env: Env): Promise<Response> {
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { sql, params } = body as { sql?: string; params?: unknown[] };

  if (typeof sql !== "string" || sql.trim().length === 0) {
    return Response.json({ error: "Missing or empty sql" }, { status: 400 });
  }

  if (WRITE_RE.test(sql)) {
    return Response.json(
      { error: "Write queries not allowed on /api/query" },
      { status: 403 },
    );
  }

  try {
    const stmt = env.DB.prepare(sql);
    const bound =
      Array.isArray(params) && params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await bound.all();

    return Response.json({
      results: result.results ?? [],
      meta: result.meta ?? { changes: 0, duration: 0 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: `D1 query failed: ${message}` },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/execute — write SQL
// ---------------------------------------------------------------------------

async function handleExecute(body: unknown, env: Env): Promise<Response> {
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Support single statement or batch
  const { sql, params, statements } = body as {
    sql?: string;
    params?: unknown[];
    statements?: Array<{ sql: string; params?: unknown[] }>;
  };

  try {
    // Batch mode
    if (Array.isArray(statements) && statements.length > 0) {
      const stmts = statements.map((s) => {
        const stmt = env.DB.prepare(s.sql);
        return Array.isArray(s.params) && s.params.length > 0
          ? stmt.bind(...s.params)
          : stmt;
      });

      const results = await env.DB.batch(stmts);

      return Response.json({
        results: results.map((r) => ({
          results: r.results ?? [],
          meta: r.meta ?? { changes: 0, duration: 0 },
        })),
      });
    }

    // Single statement mode
    if (typeof sql !== "string" || sql.trim().length === 0) {
      return Response.json({ error: "Missing or empty sql" }, { status: 400 });
    }

    const stmt = env.DB.prepare(sql);
    const bound =
      Array.isArray(params) && params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await bound.all();

    return Response.json({
      results: result.results ?? [],
      meta: result.meta ?? { changes: 0, duration: 0 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: `D1 execute failed: ${message}` },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // GET /api/live — no auth
    if (path === "/api/live") {
      if (request.method !== "GET") {
        return Response.json(
          { error: "Method not allowed" },
          { status: 405 },
        );
      }
      return handleLive(env);
    }

    // Auth: all other routes require Bearer token
    const authHeader = request.headers.get("Authorization");
    const expected = `Bearer ${env.WORKER_SECRET}`;
    if (!authHeader || authHeader !== expected) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // POST /api/query
    if (path === "/api/query") {
      if (request.method !== "POST") {
        return Response.json(
          { error: "Method not allowed" },
          { status: 405 },
        );
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json(
          { error: "Invalid JSON body" },
          { status: 400 },
        );
      }
      return handleQuery(body, env);
    }

    // POST /api/execute
    if (path === "/api/execute") {
      if (request.method !== "POST") {
        return Response.json(
          { error: "Method not allowed" },
          { status: 405 },
        );
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return Response.json(
          { error: "Invalid JSON body" },
          { status: 400 },
        );
      }
      return handleExecute(body, env);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
};

export default worker;
