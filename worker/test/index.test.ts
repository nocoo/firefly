/**
 * Unit tests for firefly Cloudflare Worker index.
 *
 * Tests the Worker's fetch handler by mocking D1 database.
 * Covers:
 * - CORS preflight handling
 * - GET /api/live — surety-standard liveness
 * - GET /api/v1/health — health check
 * - POST /api/v1/query — read-only SQL execution
 * - POST /api/v1/execute — write SQL execution (single, batch, multi-statement)
 * - POST /api/v1/fts-sync — FTS index sync
 * - POST /api/v1/fts-search — FTS search
 * - Authentication on protected routes
 * - 404 for unknown routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Types ─────────────────────────────────────────────────────────────

interface MockD1PreparedStatement {
  bind: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
}

interface MockD1Database {
  prepare: ReturnType<typeof vi.fn>;
  batch: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
}

interface MockEnv {
  DB: MockD1Database;
  WORKER_SECRET: string;
}

interface MockCtx {
  waitUntil: ReturnType<typeof vi.fn>;
}

// ─── Import Worker ──────────────────────────────────────────────────────────

let worker: {
  fetch: (request: Request, env: MockEnv, ctx: MockCtx) => Promise<Response>;
};

beforeEach(async () => {
  vi.restoreAllMocks();
  // Dynamic import to pick up fresh module state
  const mod = await import('../src/index.js');
  worker = mod.default as unknown as typeof worker;
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeEnv(overrides?: Partial<MockEnv>): MockEnv {
  const mockStatement: MockD1PreparedStatement = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    first: vi.fn().mockResolvedValue({ 1: 1 }),
    all: vi.fn().mockResolvedValue({ results: [], meta: { changes: 0, duration: 0 } }),
  };

  return {
    DB: {
      prepare: vi.fn().mockReturnValue(mockStatement),
      batch: vi.fn().mockResolvedValue([]),
      exec: vi.fn().mockResolvedValue({ count: 1, duration: 10 }),
    },
    WORKER_SECRET: 'test-secret',
    ...overrides,
  };
}

function makeCtx(): MockCtx {
  return { waitUntil: vi.fn() };
}

function makeRequest(
  path: string,
  options?: RequestInit & { auth?: boolean },
): Request {
  const headers = new Headers(options?.headers);
  if (options?.auth) {
    headers.set('Authorization', 'Bearer test-secret');
  }
  return new Request(`https://firefly.example.com${path}`, {
    ...options,
    headers,
  });
}

// ─── CORS Tests ─────────────────────────────────────────────────────────────

describe('CORS preflight', () => {
  it('responds to OPTIONS with CORS headers', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/any-path', { method: 'OPTIONS' }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
  });
});

// ─── GET /api/live Tests ────────────────────────────────────────────────────

describe('GET /api/live', () => {
  it('returns healthy status when DB is connected', async () => {
    const mockFirst = vi.fn().mockResolvedValue({ probe: 1 });
    const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ bind: mockBind, first: mockFirst }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(makeRequest('/api/live'), env, makeCtx());

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.component).toBe('firefly-worker');
    expect(json.database.connected).toBe(true);
    expect(json.uptime).toBeGreaterThanOrEqual(0);
    expect(json.timestamp).toBeDefined();
  });

  it('returns error status when DB connection fails', async () => {
    const mockFirst = vi.fn().mockRejectedValue(new Error('Connection refused'));
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ first: mockFirst }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(makeRequest('/api/live'), env, makeCtx());

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe('error');
    expect(json.database.connected).toBe(false);
    expect(json.database.error).toContain('Connection refused');
  });

  it('sanitizes "ok" in error messages', async () => {
    // Tests word-boundary replacement: \bok\b only matches whole word "ok"
    const mockFirst = vi.fn().mockRejectedValue(new Error('connection ok failed'));
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ first: mockFirst }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(makeRequest('/api/live'), env, makeCtx());
    const json = await res.json();
    // "ok" as a whole word should be replaced with "***"
    expect(json.database.error).toBe('connection *** failed');
  });

  it('returns 405 for non-GET methods', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/live', { method: 'POST' }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(405);
    const json = await res.json();
    expect(json.error).toBe('Method not allowed');
  });

  it('handles non-Error exceptions', async () => {
    const mockFirst = vi.fn().mockRejectedValue('string error');
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ first: mockFirst }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(makeRequest('/api/live'), env, makeCtx());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.database.error).toBe('string error');
  });
});

// ─── GET /api/v1/health Tests ───────────────────────────────────────────────

describe('GET /api/v1/health', () => {
  it('returns healthy status with DB latency', async () => {
    const mockFirst = vi.fn().mockResolvedValue({ 1: 1 });
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ first: mockFirst }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(makeRequest('/api/v1/health'), env, makeCtx());

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');

    const json = await res.json();
    expect(json.status).toBe('ok');
    expect(json.version).toBeDefined();
    expect(json.uptime).toBeGreaterThanOrEqual(0);
    expect(json.db.connected).toBe(true);
    expect(json.db.latencyMs).toBeGreaterThanOrEqual(0);
    expect(json.timestamp).toBeDefined();
  });

  it('returns error status when DB fails', async () => {
    const mockFirst = vi.fn().mockRejectedValue(new Error('DB error'));
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ first: mockFirst }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(makeRequest('/api/v1/health'), env, makeCtx());

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.status).toBe('error');
    expect(json.db.connected).toBe(false);
    expect(json.db.error).toBeDefined();
  });

  it('returns 405 for non-GET methods', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/health', { method: 'POST' }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(405);
  });

  it('handles non-Error exceptions', async () => {
    const mockFirst = vi.fn().mockRejectedValue('string error');
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ first: mockFirst }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(makeRequest('/api/v1/health'), env, makeCtx());
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.db.error).toBe('string error');
  });
});

// ─── Authentication Tests ───────────────────────────────────────────────────

describe('Authentication', () => {
  it('returns 401 for missing Authorization header', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        body: JSON.stringify({ sql: 'SELECT 1' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 401 for invalid token', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        headers: { Authorization: 'Bearer wrong-token' },
        body: JSON.stringify({ sql: 'SELECT 1' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(401);
  });

  it('returns 401 for malformed Authorization header', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        headers: { Authorization: 'Basic dXNlcjpwYXNz' },
        body: JSON.stringify({ sql: 'SELECT 1' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(401);
  });

  it('accepts valid Bearer token', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ sql: 'SELECT 1' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
  });

  it('rejects token of equal length but different content (constant-time compare)', async () => {
    // 'Bearer test-secret' is 18 chars; supply a same-length wrong header so
    // the comparison cannot early-exit on length and must walk the bytes.
    const wrong = 'Bearer xxxx-xxxxxx';
    expect(wrong.length).toBe('Bearer test-secret'.length);
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        headers: { Authorization: wrong },
        body: JSON.stringify({ sql: 'SELECT 1' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(401);
  });

  it('rejects token of different length', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-secret-extra' },
        body: JSON.stringify({ sql: 'SELECT 1' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(401);
  });

  it('uses fallback constant-time compare when subtle.timingSafeEqual is unavailable', async () => {
    // Vitest runs on Node, which does not expose crypto.subtle.timingSafeEqual.
    // Assert that — confirming the fallback XOR path is what the previous
    // accept/reject cases just exercised.
    const subtle = crypto.subtle as SubtleCrypto & {
      timingSafeEqual?: (a: BufferSource, b: BufferSource) => boolean;
    };
    expect(typeof subtle.timingSafeEqual).toBe('undefined');
  });
});

// ─── POST /api/v1/query Tests ───────────────────────────────────────────────

describe('POST /api/v1/query', () => {
  it('returns 405 for GET method', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/query', { auth: true }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(405);
  });

  it('returns 400 for invalid JSON body', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        auth: true,
        body: 'not json',
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid JSON body');
  });

  it('returns 400 for non-object body', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        auth: true,
        body: JSON.stringify('string'),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 for null body', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        auth: true,
        body: JSON.stringify(null),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(400);
  });

  it('returns 400 for missing sql', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({}),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Missing or empty sql');
  });

  it('returns 400 for empty sql', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ sql: '   ' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(400);
  });

  it('returns 403 for write queries', async () => {
    const env = makeEnv();

    for (const keyword of ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'PRAGMA']) {
      const res = await worker.fetch(
        makeRequest('/api/v1/query', {
          method: 'POST',
          auth: true,
          body: JSON.stringify({ sql: `${keyword} INTO posts` }),
        }),
        env,
        makeCtx(),
      );

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Write queries not allowed');
    }
  });

  it('handles case-insensitive write detection', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ sql: 'insert INTO posts' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(403);
  });

  it('allows leading whitespace before write keyword detection', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ sql: '  INSERT INTO posts' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(403);
  });

  it('executes SELECT query successfully', async () => {
    const mockAll = vi.fn().mockResolvedValue({
      results: [{ id: 1, name: 'Test' }],
      meta: { changes: 0, duration: 5 },
    });
    const mockBind = vi.fn().mockReturnValue({ all: mockAll });
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ bind: mockBind, all: mockAll }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ sql: 'SELECT * FROM posts' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toEqual([{ id: 1, name: 'Test' }]);
    expect(json.meta.changes).toBe(0);
  });

  it('executes query with params', async () => {
    const mockAll = vi.fn().mockResolvedValue({
      results: [{ id: 1 }],
      meta: { changes: 0 },
    });
    const mockBind = vi.fn().mockReturnValue({ all: mockAll });
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          sql: 'SELECT * FROM posts WHERE id = ?',
          params: ['post-123'],
        }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
    expect(mockBind).toHaveBeenCalledWith('post-123');
  });

  it('handles empty params array', async () => {
    const mockAll = vi.fn().mockResolvedValue({
      results: [],
      meta: { changes: 0 },
    });
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ all: mockAll }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ sql: 'SELECT 1', params: [] }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
  });

  it('returns 500 on D1 error', async () => {
    const mockAll = vi.fn().mockRejectedValue(new Error('Query failed'));
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ all: mockAll }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ sql: 'SELECT * FROM nonexistent' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain('D1 query failed');
  });

  it('handles non-Error exceptions', async () => {
    const mockAll = vi.fn().mockRejectedValue('string error');
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ all: mockAll }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ sql: 'SELECT 1' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(500);
  });

  it('handles missing results in response', async () => {
    const mockAll = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ all: mockAll }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ sql: 'SELECT 1' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toEqual([]);
  });

  it('handles missing meta in response', async () => {
    const mockAll = vi.fn().mockResolvedValue({ results: [] });
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ all: mockAll }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/query', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ sql: 'SELECT 1' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.meta.changes).toBe(0);
  });
});

// ─── POST /api/v1/execute Tests ─────────────────────────────────────────────

describe('POST /api/v1/execute', () => {
  it('returns 400 for invalid body', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/execute', {
        method: 'POST',
        auth: true,
        body: JSON.stringify(null),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(400);
  });

  it('returns 400 for missing sql without statements', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/execute', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({}),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(400);
  });

  it('executes single INSERT statement', async () => {
    const mockAll = vi.fn().mockResolvedValue({
      results: [],
      meta: { changes: 1, duration: 5 },
    });
    const mockBind = vi.fn().mockReturnValue({ all: mockAll });
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ bind: mockBind, all: mockAll }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/execute', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          sql: 'INSERT INTO posts (id, title) VALUES (?, ?)',
          params: ['post-1', 'Test'],
        }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.meta.changes).toBe(1);
  });

  it('executes batch statements', async () => {
    const mockBatch = vi.fn().mockResolvedValue([
      { results: [], meta: { changes: 1 } },
      { results: [], meta: { changes: 1 } },
    ]);
    const mockBind = vi.fn().mockReturnThis();
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
        batch: mockBatch,
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/execute', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          statements: [
            { sql: 'INSERT INTO posts (id) VALUES (?)', params: ['1'] },
            { sql: 'INSERT INTO posts (id) VALUES (?)', params: ['2'] },
          ],
        }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
    expect(mockBatch).toHaveBeenCalled();

    const json = await res.json();
    expect(json.results).toHaveLength(2);
  });

  it('handles batch statement without params', async () => {
    const mockBatch = vi.fn().mockResolvedValue([
      { results: [], meta: { changes: 1 } },
    ]);
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis() }),
        batch: mockBatch,
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/execute', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          statements: [{ sql: 'DELETE FROM posts' }],
        }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
  });

  it('handles batch with empty params array', async () => {
    const mockBatch = vi.fn().mockResolvedValue([
      { results: [], meta: { changes: 1 } },
    ]);
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis() }),
        batch: mockBatch,
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/execute', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          statements: [{ sql: 'DELETE FROM posts', params: [] }],
        }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
  });

  it('uses exec() for multi-statement SQL', async () => {
    const mockExec = vi.fn().mockResolvedValue({ count: 2, duration: 10 });
    const env = makeEnv({
      DB: {
        prepare: vi.fn(),
        batch: vi.fn(),
        exec: mockExec,
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/execute', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          sql: 'PRAGMA foreign_keys = OFF; DROP TABLE IF EXISTS temp;',
        }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
    expect(mockExec).toHaveBeenCalled();

    const json = await res.json();
    expect(json.results).toEqual([]);
    expect(json.meta.count).toBe(2);
  });

  it('detects multi-statement with semicolon followed by non-whitespace', async () => {
    const mockExec = vi.fn().mockResolvedValue({ count: 2, duration: 5 });
    const env = makeEnv({
      DB: {
        prepare: vi.fn(),
        batch: vi.fn(),
        exec: mockExec,
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/execute', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          sql: 'SELECT 1;SELECT 2',
        }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
    expect(mockExec).toHaveBeenCalled();
  });

  it('treats trailing semicolon as single statement', async () => {
    const mockAll = vi.fn().mockResolvedValue({
      results: [],
      meta: { changes: 1 },
    });
    const mockBind = vi.fn().mockReturnValue({ all: mockAll });
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ bind: mockBind, all: mockAll }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/execute', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          sql: 'DELETE FROM posts WHERE id = ?;',
          params: ['1'],
        }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
    // Should not use exec() for trailing semicolon
    expect(env.DB.exec).not.toHaveBeenCalled();
  });

  it('returns 500 on D1 execute error', async () => {
    const mockAll = vi.fn().mockRejectedValue(new Error('Execute failed'));
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ all: mockAll }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/execute', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ sql: 'INSERT INTO posts (id) VALUES (?)' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain('D1 execute failed');
  });

  it('handles batch missing results/meta', async () => {
    const mockBatch = vi.fn().mockResolvedValue([
      { results: undefined, meta: undefined },
    ]);
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis() }),
        batch: mockBatch,
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/execute', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          statements: [{ sql: 'DELETE FROM posts' }],
        }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results[0].results).toEqual([]);
    expect(json.results[0].meta.changes).toBe(0);
  });

  it('handles single statement missing results/meta', async () => {
    const mockAll = vi.fn().mockResolvedValue({});
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ all: mockAll }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/execute', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ sql: 'DELETE FROM posts' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toEqual([]);
    expect(json.meta.changes).toBe(0);
  });

  it('handles non-Error exceptions', async () => {
    const mockAll = vi.fn().mockRejectedValue('string error');
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ all: mockAll }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/execute', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ sql: 'DELETE FROM posts' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(500);
  });
});

// ─── FTS Endpoint Integration Tests ─────────────────────────────────────────

describe('POST /api/v1/fts-sync', () => {
  it('requires authentication', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/fts-sync', {
        method: 'POST',
        body: JSON.stringify({ action: 'upsert', postId: '1' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(401);
  });

  it('routes to FTS sync handler', async () => {
    const mockFirst = vi.fn().mockResolvedValue({ rowid: 1 });
    const mockBind = vi.fn().mockReturnValue({
      first: mockFirst,
      bind: vi.fn().mockReturnThis(),
    });
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
        batch: vi.fn().mockResolvedValue([]),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/fts-sync', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({
          action: 'upsert',
          postId: 'test-post',
          title: 'Test',
        }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/fts-search', () => {
  it('requires authentication', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/fts-search', {
        method: 'POST',
        body: JSON.stringify({ query: 'test' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(401);
  });

  it('routes to FTS search handler', async () => {
    const mockAll = vi.fn().mockResolvedValue({ results: [] });
    const mockFirst = vi.fn().mockResolvedValue({ count: 0 });
    const mockBind = vi.fn().mockReturnValue({
      all: mockAll,
      first: mockFirst,
      bind: vi.fn().mockReturnThis(),
    });
    const env = makeEnv({
      DB: {
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
        batch: vi.fn(),
        exec: vi.fn(),
      },
    });

    const res = await worker.fetch(
      makeRequest('/api/v1/fts-search', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ query: 'hello' }),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(200);
  });
});

// ─── 404 Tests ──────────────────────────────────────────────────────────────

describe('404 handling', () => {
  it('returns 404 for unknown paths', async () => {
    const env = makeEnv();
    const res = await worker.fetch(makeRequest('/unknown'), env, makeCtx());

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('Not found');
  });

  it('returns 404 for unknown /api/v1 paths with auth', async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      makeRequest('/api/v1/unknown', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({}),
      }),
      env,
      makeCtx(),
    );

    expect(res.status).toBe(404);
  });

  it('returns 404 for root path', async () => {
    const env = makeEnv();
    const res = await worker.fetch(makeRequest('/'), env, makeCtx());

    expect(res.status).toBe(404);
  });
});
