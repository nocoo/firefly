/**
 * AI Agents API — Route validation tests
 *
 * Tests for input normalization and validation in POST/PATCH handlers.
 * These are unit tests using mocked handlers, not E2E tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies before importing routes
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(),
}));

vi.mock("@/data/entities/ai-agent", () => ({
  createAiAgent: vi.fn(),
  getAiAgentById: vi.fn(),
  getAiAgentBySlug: vi.fn(),
  updateAiAgent: vi.fn(),
}));

vi.mock("@/data/entities/category", () => ({
  getCategoryById: vi.fn(),
}));

vi.mock("@/lib/ai-agent/prompt-generator", () => ({
  generateAgentPrompt: vi.fn(() => "mock prompt"),
}));

vi.mock("@/lib/seo", () => ({
  SITE_URL: "https://example.com",
}));

import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  createAiAgent,
  getAiAgentById,
  getAiAgentBySlug,
  updateAiAgent,
} from "@/data/entities/ai-agent";
import { getCategoryById } from "@/data/entities/category";
import { POST } from "./route";
import { PATCH } from "./[id]/route";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);

const mockAgent = {
  id: "agent-1",
  name: "Test Agent",
  slug: "test-agent",
  description: null,
  category_id: "cat-1",
  api_key_hash: "hash",
  api_key_preview: "preview",
  avatar_version: null,
  is_active: 1,
  last_used_at: null,
  created_at: now,
  updated_at: now,
};

const mockCategory = {
  id: "cat-1",
  name: "Test Category",
  slug: "test-category",
  description: null,
  sort_order: 0,
  post_count: 0,
  created_at: now,
  updated_at: now,
};

const mockDb = {};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function createRequest(body: unknown, method = "POST"): NextRequest {
  return new NextRequest("http://localhost/api/admin/ai-agents", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// POST /api/admin/ai-agents — Create validation
// ---------------------------------------------------------------------------

describe("POST /api/admin/ai-agents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth).mockResolvedValue({ user: { email: "admin@example.com" } } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getDb).mockReturnValue(mockDb as any);
  });

  it("rejects empty name after trim", async () => {
    const request = createRequest({
      name: "   ",
      slug: "valid-slug",
      categoryId: "cat-1",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("name is required");
  });

  it("rejects empty slug after trim", async () => {
    const request = createRequest({
      name: "Valid Name",
      slug: "   ",
      categoryId: "cat-1",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("slug is required");
  });

  it("checks slug uniqueness with trimmed value", async () => {
    vi.mocked(getAiAgentBySlug).mockResolvedValue(mockAgent);
    vi.mocked(getCategoryById).mockResolvedValue(mockCategory);

    const request = createRequest({
      name: "New Agent",
      slug: "  test-agent  ", // has whitespace, trims to existing slug
      categoryId: "cat-1",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("An agent with this slug already exists");

    // Verify we checked with trimmed slug
    expect(getAiAgentBySlug).toHaveBeenCalledWith(mockDb, "test-agent");
  });

  it("creates agent with trimmed values", async () => {
    vi.mocked(getAiAgentBySlug).mockResolvedValue(null);
    vi.mocked(getCategoryById).mockResolvedValue(mockCategory);
    vi.mocked(createAiAgent).mockResolvedValue({
      agent: mockAgent,
      plaintextKey: "firefly_agent_abc123",
    });

    const request = createRequest({
      name: "  New Agent  ",
      slug: "  new-agent  ",
      description: "  A description  ",
      categoryId: "cat-1",
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    // Verify trimmed values were passed
    expect(createAiAgent).toHaveBeenCalledWith(mockDb, {
      name: "New Agent",
      slug: "new-agent",
      description: "A description",
      categoryId: "cat-1",
    });
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/ai-agents/[id] — Update validation
// ---------------------------------------------------------------------------

describe("PATCH /api/admin/ai-agents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth).mockResolvedValue({ user: { email: "admin@example.com" } } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getDb).mockReturnValue(mockDb as any);
    vi.mocked(getAiAgentById).mockResolvedValue(mockAgent);
    vi.mocked(getCategoryById).mockResolvedValue(mockCategory);
  });

  it("rejects empty name after trim", async () => {
    const request = new NextRequest("http://localhost/api/admin/ai-agents/agent-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "agent-1" }) });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("name cannot be empty");
  });

  it("rejects empty slug after trim", async () => {
    const request = new NextRequest("http://localhost/api/admin/ai-agents/agent-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "   " }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "agent-1" }) });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("slug cannot be empty");
  });

  it("checks slug uniqueness with trimmed value", async () => {
    const otherAgent = { ...mockAgent, id: "agent-2", slug: "other-agent" };
    vi.mocked(getAiAgentBySlug).mockResolvedValue(otherAgent);

    const request = new NextRequest("http://localhost/api/admin/ai-agents/agent-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "  other-agent  " }), // trims to conflicting slug
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "agent-1" }) });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("An agent with this slug already exists");

    // Verify we checked with trimmed slug
    expect(getAiAgentBySlug).toHaveBeenCalledWith(mockDb, "other-agent");
  });

  it("skips uniqueness check when slug unchanged after trim", async () => {
    const request = new NextRequest("http://localhost/api/admin/ai-agents/agent-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "  test-agent  " }), // same as existing after trim
    });

    vi.mocked(updateAiAgent).mockResolvedValue(mockAgent);

    const response = await PATCH(request, { params: Promise.resolve({ id: "agent-1" }) });
    expect(response.status).toBe(200);

    // Should NOT check uniqueness since slug is unchanged
    expect(getAiAgentBySlug).not.toHaveBeenCalled();
  });

  it("updates agent with trimmed values", async () => {
    vi.mocked(getAiAgentBySlug).mockResolvedValue(null);
    vi.mocked(updateAiAgent).mockResolvedValue({
      ...mockAgent,
      name: "Updated Name",
      slug: "updated-slug",
    });

    const request = new NextRequest("http://localhost/api/admin/ai-agents/agent-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "  Updated Name  ",
        slug: "  updated-slug  ",
        description: "  Updated description  ",
      }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "agent-1" }) });
    expect(response.status).toBe(200);

    // Verify trimmed values were passed
    expect(updateAiAgent).toHaveBeenCalledWith(mockDb, "agent-1", {
      name: "Updated Name",
      slug: "updated-slug",
      description: "Updated description",
    });
  });

  it("allows null description", async () => {
    vi.mocked(updateAiAgent).mockResolvedValue({
      ...mockAgent,
      description: null,
    });

    const request = new NextRequest("http://localhost/api/admin/ai-agents/agent-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: null }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ id: "agent-1" }) });
    expect(response.status).toBe(200);

    expect(updateAiAgent).toHaveBeenCalledWith(mockDb, "agent-1", {
      description: null,
    });
  });
});
