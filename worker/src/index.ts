/**
 * firefly Worker — Cloudflare Worker with native D1 binding.
 *
 * Routes:
 * - GET  /api/live            — surety-standard liveness (no auth)
 * - GET  /api/v1/health      — health check (no auth)
 * - POST /api/v1/query       — execute read-only SQL (regex guards writes)
 * - POST /api/v1/execute     — execute write SQL (single + batch)
 * - POST /api/v1/fts-sync    — sync single post to FTS index
 * - POST /api/v1/fts-search  — full-text search with BM25 ranking
 *
 * Auth: Bearer WORKER_SECRET on all POST /api/v1/* routes.
 */

import { handleFtsSync, handleFtsSearch } from "./fts";
import pkg from "../package.json";

const VERSION = pkg.version;

const bootTime = Date.now();

export interface Env {
  DB: D1Database;
  WORKER_SECRET: string;
}

const WRITE_RE = /^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|PRAGMA)\b/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(
  data: unknown,
  status: number = 200,
  headers?: Record<string, string>,
): Response {
  return Response.json(data, {
    status,
    headers: { ...headers },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

// ---------------------------------------------------------------------------
// GET /api/v1/health
// ---------------------------------------------------------------------------

async function handleHealth(env: Env): Promise<Response> {
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

  return jsonResponse(
    {
      status: isHealthy ? "ok" : "error",
      version: VERSION,
      uptime: Math.round((Date.now() - bootTime) / 1000),
      db: dbStatus,
      timestamp: new Date().toISOString(),
    },
    isHealthy ? 200 : 503,
    { "Cache-Control": "no-store" },
  );
}

// ---------------------------------------------------------------------------
// GET /api/live — surety-standard liveness
// ---------------------------------------------------------------------------

async function handleLive(env: Env): Promise<Response> {
  const timestamp = new Date().toISOString();
  const uptime = Math.round((Date.now() - bootTime) / 1000);

  let database: { connected: boolean; error?: string } = { connected: false };
  try {
    await env.DB.prepare("SELECT 1 AS probe").first();
    database = { connected: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    database = { connected: false, error: msg.replace(/\bok\b/gi, "***") };
  }

  const healthy = database.connected;

  return jsonResponse(
    {
      status: healthy ? "ok" : "error",
      version: VERSION,
      component: "firefly-worker",
      timestamp,
      uptime,
      database,
    },
    healthy ? 200 : 503,
    { "Cache-Control": "no-store" },
  );
}

// ---------------------------------------------------------------------------
// POST /api/v1/query — read-only SQL
// ---------------------------------------------------------------------------

async function handleQuery(body: unknown, env: Env): Promise<Response> {
  if (typeof body !== "object" || body === null) {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  const { sql, params } = body as { sql?: string; params?: unknown[] };

  if (typeof sql !== "string" || sql.trim().length === 0) {
    return jsonResponse({ error: "Missing or empty sql" }, 400);
  }

  if (WRITE_RE.test(sql)) {
    return jsonResponse(
      { error: "Write queries not allowed on /api/v1/query" },
      403,
    );
  }

  try {
    const stmt = env.DB.prepare(sql);
    const bound =
      Array.isArray(params) && params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await bound.all();

    return jsonResponse({
      results: result.results ?? [],
      meta: result.meta ?? { changes: 0, duration: 0 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `D1 query failed: ${message}` }, 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/execute — write SQL
// ---------------------------------------------------------------------------

async function handleExecute(body: unknown, env: Env): Promise<Response> {
  if (typeof body !== "object" || body === null) {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  // Support single statement, batch array, or raw multi-statement string
  const { sql, params, statements } = body as {
    sql?: string;
    params?: unknown[];
    statements?: Array<{ sql: string; params?: unknown[] }>;
  };

  try {
    // Batch mode (array of statements)
    if (Array.isArray(statements) && statements.length > 0) {
      const stmts = statements.map((s) => {
        const stmt = env.DB.prepare(s.sql);
        return Array.isArray(s.params) && s.params.length > 0
          ? stmt.bind(...s.params)
          : stmt;
      });

      const results = await env.DB.batch(stmts);

      return jsonResponse({
        results: results.map((r) => ({
          results: r.results ?? [],
          meta: r.meta ?? { changes: 0, duration: 0 },
        })),
      });
    }

    // Single or multi-statement mode
    if (typeof sql !== "string" || sql.trim().length === 0) {
      return jsonResponse({ error: "Missing or empty sql" }, 400);
    }

    // Check if SQL contains multiple statements (semicolon followed by non-whitespace)
    // This heuristic detects "stmt1; stmt2" patterns
    const isMultiStatement = /;\s*\S/.test(sql);

    if (isMultiStatement) {
      // Use exec() for multi-statement SQL (migrations with PRAGMA, etc.)
      // exec() preserves connection-level state across statements
      const result = await env.DB.exec(sql);
      return jsonResponse({
        results: [],
        meta: { count: result.count, duration: result.duration },
      });
    }

    // Single statement mode
    const stmt = env.DB.prepare(sql);
    const bound =
      Array.isArray(params) && params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await bound.all();

    return jsonResponse({
      results: result.results ?? [],
      meta: result.meta ?? { changes: 0, duration: 0 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `D1 execute failed: ${message}` }, 500);
  }
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function authenticate(request: Request, env: Env): Response | null {
  const authHeader = request.headers.get("Authorization");
  const expected = `Bearer ${env.WORKER_SECRET}`;
  if (!authHeader || authHeader !== expected) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  return null;
}

// ---------------------------------------------------------------------------
// JSON body parser
// ---------------------------------------------------------------------------

async function parseJsonBody(request: Request): Promise<unknown | Response> {
  try {
    return await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
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
      return new Response(null, { headers: corsHeaders() });
    }

    // GET /api/live — surety-standard liveness (no auth)
    if (path === "/api/live") {
      if (request.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }
      return handleLive(env);
    }

    // GET /api/v1/health — no auth
    if (path === "/api/v1/health") {
      if (request.method !== "GET") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }
      return handleHealth(env);
    }

    // Auth: all other /api/v1/* routes require Bearer token
    if (path.startsWith("/api/v1/")) {
      const authError = authenticate(request, env);
      if (authError) return authError;

      if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }

      const bodyOrError = await parseJsonBody(request);
      if (bodyOrError instanceof Response) return bodyOrError;

      if (path === "/api/v1/query") {
        return handleQuery(bodyOrError, env);
      }

      if (path === "/api/v1/execute") {
        return handleExecute(bodyOrError, env);
      }

      // FTS endpoints
      if (path === "/api/v1/fts-sync") {
        return handleFtsSync(bodyOrError, env.DB);
      }

      if (path === "/api/v1/fts-search") {
        return handleFtsSearch(bodyOrError, env.DB);
      }
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};

export default worker;
