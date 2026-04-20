/**
 * Unit tests for FTS5 full-text search module.
 *
 * Tests:
 * - segmentText(): CJK + Latin word segmentation
 * - sanitizeFtsQuery(): FTS5 MATCH expression builder
 * - handleFtsSync(): upsert/delete operations
 * - handleFtsSearch(): full-text search with pagination
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { segmentText, sanitizeFtsQuery, handleFtsSync, handleFtsSearch } from '../src/fts.js';

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
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeDb(overrides?: Partial<MockD1Database>): MockD1Database {
  const mockStatement: MockD1PreparedStatement = {
    bind: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [], meta: { changes: 0 } }),
  };

  return {
    prepare: vi.fn().mockReturnValue(mockStatement),
    batch: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

// ─── segmentText Tests ──────────────────────────────────────────────────────

describe('segmentText', () => {
  it('returns empty string for empty input', () => {
    expect(segmentText('')).toBe('');
  });

  it('returns empty string for null/undefined', () => {
    expect(segmentText(null as unknown as string)).toBe('');
    expect(segmentText(undefined as unknown as string)).toBe('');
  });

  it('segments English words correctly', () => {
    const result = segmentText('Hello World');
    expect(result).toBe('hello world');
  });

  it('segments Chinese characters correctly', () => {
    const result = segmentText('你好世界');
    // Intl.Segmenter should split CJK into words
    expect(result).toContain('你好');
    expect(result).toContain('世界');
  });

  it('handles mixed CJK and Latin text', () => {
    const result = segmentText('Hello 世界 Test');
    expect(result.toLowerCase()).toContain('hello');
    expect(result).toContain('世界');
    expect(result.toLowerCase()).toContain('test');
  });

  it('converts to lowercase', () => {
    const result = segmentText('UPPERCASE');
    expect(result).toBe('uppercase');
  });

  it('filters out non-word characters', () => {
    const result = segmentText('hello, world!');
    expect(result).toBe('hello world');
  });
});

// ─── sanitizeFtsQuery Tests ─────────────────────────────────────────────────

describe('sanitizeFtsQuery', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeFtsQuery('')).toBe('');
    expect(sanitizeFtsQuery('   ')).toBe('');
  });

  it('quotes plain terms', () => {
    const result = sanitizeFtsQuery('hello world');
    expect(result).toBe('"hello" "world"');
  });

  it('preserves quoted phrases', () => {
    const result = sanitizeFtsQuery('"exact phrase"');
    expect(result).toContain('"exact phrase"');
  });

  it('handles prefix search with trailing *', () => {
    const result = sanitizeFtsQuery('cloud*');
    expect(result).toContain('"cloud"*');
  });

  it('handles mixed quoted and unquoted text', () => {
    const result = sanitizeFtsQuery('hello "exact phrase" world');
    expect(result).toContain('"hello"');
    expect(result).toContain('"exact phrase"');
    expect(result).toContain('"world"');
  });

  it('escapes FTS5 special characters', () => {
    // Special chars like :, ^, +, -, etc. should be removed
    const result = sanitizeFtsQuery('hello:world');
    expect(result).not.toContain(':');
  });

  it('handles CJK text', () => {
    const result = sanitizeFtsQuery('你好世界');
    // Should segment and quote CJK words
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles prefix search on CJK', () => {
    const result = sanitizeFtsQuery('你好*');
    expect(result).toContain('*');
  });

  it('handles multiple prefix terms', () => {
    const result = sanitizeFtsQuery('hello* world*');
    expect((result.match(/\*/g) || []).length).toBe(2);
  });

  it('handles empty quoted phrase', () => {
    const result = sanitizeFtsQuery('""');
    // Empty quotes should result in empty or minimal output
    expect(result).toBe('');
  });

  it('handles nested quotes gracefully', () => {
    const result = sanitizeFtsQuery('"hello "world""');
    // Should handle malformed quotes gracefully
    expect(typeof result).toBe('string');
  });
});

// ─── handleFtsSync Tests ────────────────────────────────────────────────────

describe('handleFtsSync', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 for invalid body', async () => {
    const db = makeDb();
    const res = await handleFtsSync(null, db as unknown as D1Database);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Invalid request body');
  });

  it('returns 400 for non-object body', async () => {
    const db = makeDb();
    const res = await handleFtsSync('string', db as unknown as D1Database);
    expect(res.status).toBe(400);
  });

  describe('delete action', () => {
    it('returns 400 if rowid is missing', async () => {
      const db = makeDb();
      const res = await handleFtsSync({ action: 'delete' }, db as unknown as D1Database);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('rowid is required for delete');
    });

    it('deletes FTS entry by rowid', async () => {
      const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const db = makeDb({
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
      });

      const res = await handleFtsSync(
        { action: 'delete', rowid: 42 },
        db as unknown as D1Database,
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.action).toBe('delete');
      expect(json.rowid).toBe(42);
      expect(mockBind).toHaveBeenCalledWith(42);
    });
  });

  describe('upsert action', () => {
    it('returns 400 if postId is missing', async () => {
      const db = makeDb();
      const res = await handleFtsSync({ action: 'upsert' }, db as unknown as D1Database);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('postId is required for upsert');
    });

    it('returns 404 if post not found', async () => {
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const db = makeDb({
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
      });

      const res = await handleFtsSync(
        { action: 'upsert', postId: 'nonexistent' },
        db as unknown as D1Database,
      );

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('not found');
    });

    it('upserts FTS entry successfully', async () => {
      const mockFirst = vi.fn().mockResolvedValue({ rowid: 123 });
      const mockBind = vi.fn().mockReturnValue({
        first: mockFirst,
        bind: vi.fn().mockReturnThis(),
      });
      const mockBatch = vi.fn().mockResolvedValue([]);
      const db = makeDb({
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
        batch: mockBatch,
      });

      const res = await handleFtsSync(
        {
          action: 'upsert',
          postId: 'post-123',
          title: 'Test Title',
          content: 'Test content here',
          excerpt: 'Test excerpt',
        },
        db as unknown as D1Database,
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.action).toBe('upsert');
      expect(json.postId).toBe('post-123');
      expect(mockBatch).toHaveBeenCalled();
    });

    it('handles empty title/content/excerpt', async () => {
      const mockFirst = vi.fn().mockResolvedValue({ rowid: 123 });
      const mockBind = vi.fn().mockReturnValue({
        first: mockFirst,
        bind: vi.fn().mockReturnThis(),
      });
      const mockBatch = vi.fn().mockResolvedValue([]);
      const db = makeDb({
        prepare: vi.fn().mockReturnValue({ bind: mockBind }),
        batch: mockBatch,
      });

      const res = await handleFtsSync(
        { action: 'upsert', postId: 'post-123' },
        db as unknown as D1Database,
      );

      expect(res.status).toBe(200);
    });
  });

  it('returns 400 for unknown action', async () => {
    const db = makeDb();
    const res = await handleFtsSync(
      { action: 'invalid' as 'upsert' },
      db as unknown as D1Database,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Unknown action');
  });
});

// ─── handleFtsSearch Tests ──────────────────────────────────────────────────

describe('handleFtsSearch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 400 for invalid body', async () => {
    const db = makeDb();
    const res = await handleFtsSearch(null, db as unknown as D1Database);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing query', async () => {
    const db = makeDb();
    const res = await handleFtsSearch({}, db as unknown as D1Database);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('query is required');
  });

  it('returns 400 for empty query string', async () => {
    const db = makeDb();
    const res = await handleFtsSearch({ query: '   ' }, db as unknown as D1Database);
    expect(res.status).toBe(400);
  });

  it('returns empty results for query that produces no MATCH expression', async () => {
    const db = makeDb();
    // Query with only special chars that get stripped
    const res = await handleFtsSearch({ query: '""' }, db as unknown as D1Database);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.posts).toEqual([]);
    expect(json.total).toBe(0);
  });

  it('executes search with default pagination', async () => {
    const mockAll = vi.fn().mockResolvedValue({
      results: [
        {
          id: 'post-1',
          title: 'Test Post',
          slug: 'test-post',
          excerpt: null,
          content: 'content',
          content_html: '<p>content</p>',
          status: 'published',
          category_id: null,
          category_name: null,
          category_slug: null,
          featured_image: null,
          reading_time: 1,
          comment_count: 0,
          view_count: 10,
          comment_enabled: 1,
          published_at: 1704067200000,
          created_at: 1704067200000,
          updated_at: 1704067200000,
          reference_url: null,
          reference_title: null,
          reference_description: null,
          reference_image: null,
          search_snippet: 'test <mark>hello</mark> world',
        },
      ],
    });
    const mockFirst = vi.fn().mockResolvedValue({ count: 1 });
    const mockBind = vi.fn().mockReturnValue({
      all: mockAll,
      first: mockFirst,
      bind: vi.fn().mockReturnThis(),
    });
    const db = makeDb({
      prepare: vi.fn().mockReturnValue({ bind: mockBind }),
    });

    const res = await handleFtsSearch({ query: 'hello' }, db as unknown as D1Database);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.posts).toHaveLength(1);
    expect(json.posts[0].id).toBe('post-1');
    expect(json.snippets['post-1']).toBe('test <mark>hello</mark> world');
    expect(json.total).toBe(1);
    expect(json.page).toBe(1);
    expect(json.pageSize).toBe(20);
  });

  it('applies status filter when provided', async () => {
    const mockAll = vi.fn().mockResolvedValue({ results: [] });
    const mockFirst = vi.fn().mockResolvedValue({ count: 0 });
    const mockBind = vi.fn().mockReturnValue({
      all: mockAll,
      first: mockFirst,
      bind: vi.fn().mockReturnThis(),
    });
    const prepareMock = vi.fn().mockReturnValue({ bind: mockBind });
    const db = makeDb({ prepare: prepareMock });

    const res = await handleFtsSearch(
      { query: 'test', status: 'published' },
      db as unknown as D1Database,
    );

    expect(res.status).toBe(200);
    // Verify bind was called with status parameter
    expect(mockBind).toHaveBeenCalled();
  });

  it('handles custom pagination', async () => {
    const mockAll = vi.fn().mockResolvedValue({ results: [] });
    const mockFirst = vi.fn().mockResolvedValue({ count: 100 });
    const mockBind = vi.fn().mockReturnValue({
      all: mockAll,
      first: mockFirst,
      bind: vi.fn().mockReturnThis(),
    });
    const db = makeDb({
      prepare: vi.fn().mockReturnValue({ bind: mockBind }),
    });

    const res = await handleFtsSearch(
      { query: 'test', page: 3, pageSize: 10 },
      db as unknown as D1Database,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.page).toBe(3);
    expect(json.pageSize).toBe(10);
  });

  it('clamps invalid page to 1', async () => {
    const mockAll = vi.fn().mockResolvedValue({ results: [] });
    const mockFirst = vi.fn().mockResolvedValue({ count: 0 });
    const mockBind = vi.fn().mockReturnValue({
      all: mockAll,
      first: mockFirst,
      bind: vi.fn().mockReturnThis(),
    });
    const db = makeDb({
      prepare: vi.fn().mockReturnValue({ bind: mockBind }),
    });

    const res = await handleFtsSearch(
      { query: 'test', page: -5 },
      db as unknown as D1Database,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.page).toBe(1);
  });

  it('clamps invalid pageSize to default', async () => {
    const mockAll = vi.fn().mockResolvedValue({ results: [] });
    const mockFirst = vi.fn().mockResolvedValue({ count: 0 });
    const mockBind = vi.fn().mockReturnValue({
      all: mockAll,
      first: mockFirst,
      bind: vi.fn().mockReturnThis(),
    });
    const db = makeDb({
      prepare: vi.fn().mockReturnValue({ bind: mockBind }),
    });

    const res = await handleFtsSearch(
      { query: 'test', pageSize: 0 },
      db as unknown as D1Database,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pageSize).toBe(20);
  });

  it('clamps pageSize to max 100', async () => {
    const mockAll = vi.fn().mockResolvedValue({ results: [] });
    const mockFirst = vi.fn().mockResolvedValue({ count: 0 });
    const mockBind = vi.fn().mockReturnValue({
      all: mockAll,
      first: mockFirst,
      bind: vi.fn().mockReturnThis(),
    });
    const db = makeDb({
      prepare: vi.fn().mockReturnValue({ bind: mockBind }),
    });

    const res = await handleFtsSearch(
      { query: 'test', pageSize: 500 },
      db as unknown as D1Database,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pageSize).toBe(100);
  });

  it('returns 500 on database error', async () => {
    const mockAll = vi.fn().mockRejectedValue(new Error('DB connection failed'));
    const mockBind = vi.fn().mockReturnValue({
      all: mockAll,
      first: mockAll,
      bind: vi.fn().mockReturnThis(),
    });
    const db = makeDb({
      prepare: vi.fn().mockReturnValue({ bind: mockBind }),
    });

    const res = await handleFtsSearch({ query: 'test' }, db as unknown as D1Database);
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain('FTS search failed');
  });

  it('handles non-Error exceptions', async () => {
    const mockAll = vi.fn().mockRejectedValue('string error');
    const mockBind = vi.fn().mockReturnValue({
      all: mockAll,
      first: mockAll,
      bind: vi.fn().mockReturnThis(),
    });
    const db = makeDb({
      prepare: vi.fn().mockReturnValue({ bind: mockBind }),
    });

    const res = await handleFtsSearch({ query: 'test' }, db as unknown as D1Database);
    expect(res.status).toBe(500);
  });

  it('handles missing count result', async () => {
    const mockAll = vi.fn().mockResolvedValue({
      results: [
        {
          id: 'post-1',
          title: 'Test',
          slug: 'test',
          search_snippet: 'snippet',
        },
      ],
    });
    const mockFirst = vi.fn().mockResolvedValue(null);
    const mockBind = vi.fn().mockReturnValue({
      all: mockAll,
      first: mockFirst,
      bind: vi.fn().mockReturnThis(),
    });
    const db = makeDb({
      prepare: vi.fn().mockReturnValue({ bind: mockBind }),
    });

    const res = await handleFtsSearch({ query: 'test' }, db as unknown as D1Database);
    expect(res.status).toBe(200);
    const json = await res.json();
    // Falls back to posts.length
    expect(json.total).toBe(1);
  });

  it('handles NaN page value', async () => {
    const mockAll = vi.fn().mockResolvedValue({ results: [] });
    const mockFirst = vi.fn().mockResolvedValue({ count: 0 });
    const mockBind = vi.fn().mockReturnValue({
      all: mockAll,
      first: mockFirst,
      bind: vi.fn().mockReturnThis(),
    });
    const db = makeDb({
      prepare: vi.fn().mockReturnValue({ bind: mockBind }),
    });

    const res = await handleFtsSearch(
      { query: 'test', page: NaN },
      db as unknown as D1Database,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.page).toBe(1);
  });

  it('handles Infinity pageSize', async () => {
    const mockAll = vi.fn().mockResolvedValue({ results: [] });
    const mockFirst = vi.fn().mockResolvedValue({ count: 0 });
    const mockBind = vi.fn().mockReturnValue({
      all: mockAll,
      first: mockFirst,
      bind: vi.fn().mockReturnThis(),
    });
    const db = makeDb({
      prepare: vi.fn().mockReturnValue({ bind: mockBind }),
    });

    const res = await handleFtsSearch(
      { query: 'test', pageSize: Infinity },
      db as unknown as D1Database,
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.pageSize).toBe(20); // Falls back to default
  });
});
