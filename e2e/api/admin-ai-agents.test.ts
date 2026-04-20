/**
 * L2 API E2E — Admin AI Agents endpoints
 *
 * Covers: GET /api/admin/ai-agents, POST /api/admin/ai-agents,
 *         GET /api/admin/ai-agents/[id], PATCH /api/admin/ai-agents/[id],
 *         DELETE /api/admin/ai-agents/[id],
 *         POST /api/admin/ai-agents/[id]/avatar, DELETE /api/admin/ai-agents/[id]/avatar,
 *         GET /api/admin/ai-agents/[id]/prompt
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Helper to get a valid category ID for agent creation */
async function getFirstCategoryId(): Promise<string | null> {
  const res = await fetch(`${BASE}/api/categories`);
  if (!res.ok) return null;
  const body = await res.json();
  return body.categories?.[0]?.id ?? null;
}

/** Helper to create an agent and return its ID */
async function createTestAgent(
  categoryId: string,
  suffix = Date.now().toString(),
): Promise<{ id: string; slug: string } | null> {
  const res = await fetch(`${BASE}/api/admin/ai-agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `E2E Test Agent ${suffix}`,
      slug: `e2e-test-agent-${suffix}`,
      description: "Test agent for E2E",
      categoryId,
    }),
  });
  if (!res.ok) return null;
  const body = await res.json();
  return { id: body.agent?.id, slug: body.agent?.slug };
}

/** Helper to delete an agent (cleanup) */
async function deleteAgent(id: string): Promise<void> {
  await fetch(`${BASE}/api/admin/ai-agents/${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// GET /api/admin/ai-agents
// ---------------------------------------------------------------------------

describe("GET /api/admin/ai-agents", () => {
  it("returns list of agents", async () => {
    const res = await fetch(`${BASE}/api/admin/ai-agents`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("agents");
    expect(Array.isArray(body.agents)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/ai-agents
// ---------------------------------------------------------------------------

describe("POST /api/admin/ai-agents", () => {
  let categoryId: string | null = null;
  let createdAgentId: string | null = null;

  beforeAll(async () => {
    categoryId = await getFirstCategoryId();
  });

  afterAll(async () => {
    if (createdAgentId) {
      await deleteAgent(createdAgentId);
    }
  });

  it("creates a new agent with valid data", async () => {
    if (!categoryId) {
      console.warn("Skipping: no category available");
      return;
    }

    const slug = `e2e-create-agent-${Date.now()}`;
    const res = await fetch(`${BASE}/api/admin/ai-agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "E2E Create Test Agent",
        slug,
        description: "Created by E2E test",
        categoryId,
      }),
    });

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.agent).toBeDefined();
    expect(body.agent.name).toBe("E2E Create Test Agent");
    expect(body.agent.slug).toBe(slug);
    expect(body.prompt).toBeDefined();

    createdAgentId = body.agent.id;
  });

  it("returns 400 when name is missing", async () => {
    if (!categoryId) return;

    const res = await fetch(`${BASE}/api/admin/ai-agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "missing-name-agent",
        categoryId,
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when slug is missing", async () => {
    if (!categoryId) return;

    const res = await fetch(`${BASE}/api/admin/ai-agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Missing Slug Agent",
        categoryId,
      }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 400 when categoryId is invalid", async () => {
    const res = await fetch(`${BASE}/api/admin/ai-agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Invalid Category Agent",
        slug: "invalid-category-agent",
        categoryId: "nonexistent-category-id",
      }),
    });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/ai-agents/[id]
// ---------------------------------------------------------------------------

describe("GET /api/admin/ai-agents/[id]", () => {
  let categoryId: string | null = null;
  let testAgent: { id: string; slug: string } | null = null;

  beforeAll(async () => {
    categoryId = await getFirstCategoryId();
    if (categoryId) {
      testAgent = await createTestAgent(categoryId, `get-${Date.now()}`);
    }
  });

  afterAll(async () => {
    if (testAgent) {
      await deleteAgent(testAgent.id);
    }
  });

  it("returns agent by ID", async () => {
    if (!testAgent) {
      console.warn("Skipping: no test agent created");
      return;
    }

    const res = await fetch(`${BASE}/api/admin/ai-agents/${testAgent.id}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.agent).toBeDefined();
    expect(body.agent.id).toBe(testAgent.id);
  });

  it("returns 404 for non-existent agent", async () => {
    const res = await fetch(`${BASE}/api/admin/ai-agents/nonexistent-id-12345`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/ai-agents/[id]
// ---------------------------------------------------------------------------

describe("PATCH /api/admin/ai-agents/[id]", () => {
  let categoryId: string | null = null;
  let testAgent: { id: string; slug: string } | null = null;

  beforeAll(async () => {
    categoryId = await getFirstCategoryId();
    if (categoryId) {
      testAgent = await createTestAgent(categoryId, `patch-${Date.now()}`);
    }
  });

  afterAll(async () => {
    if (testAgent) {
      await deleteAgent(testAgent.id);
    }
  });

  it("updates agent name", async () => {
    if (!testAgent) return;

    const newName = `Updated Agent ${Date.now()}`;
    const res = await fetch(`${BASE}/api/admin/ai-agents/${testAgent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.agent.name).toBe(newName);
  });

  it("updates agent description to null", async () => {
    if (!testAgent) return;

    const res = await fetch(`${BASE}/api/admin/ai-agents/${testAgent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: null }),
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.agent.description).toBeNull();
  });

  it("returns 400 when name is empty string", async () => {
    if (!testAgent) return;

    const res = await fetch(`${BASE}/api/admin/ai-agents/${testAgent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });

    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent agent", async () => {
    const res = await fetch(`${BASE}/api/admin/ai-agents/nonexistent-id`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test" }),
    });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/ai-agents/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/admin/ai-agents/[id]", () => {
  let categoryId: string | null = null;

  beforeAll(async () => {
    categoryId = await getFirstCategoryId();
  });

  it("deletes an agent", async () => {
    if (!categoryId) return;

    const testAgent = await createTestAgent(categoryId, `delete-${Date.now()}`);
    if (!testAgent) return;

    const res = await fetch(`${BASE}/api/admin/ai-agents/${testAgent.id}`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify deletion
    const getRes = await fetch(`${BASE}/api/admin/ai-agents/${testAgent.id}`);
    expect(getRes.status).toBe(404);
  });

  it("returns 404 for non-existent agent", async () => {
    const res = await fetch(`${BASE}/api/admin/ai-agents/nonexistent-id`, {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/ai-agents/[id]/prompt
// ---------------------------------------------------------------------------

describe("GET /api/admin/ai-agents/[id]/prompt", () => {
  let categoryId: string | null = null;
  let testAgent: { id: string; slug: string } | null = null;

  beforeAll(async () => {
    categoryId = await getFirstCategoryId();
    if (categoryId) {
      testAgent = await createTestAgent(categoryId, `prompt-${Date.now()}`);
    }
  });

  afterAll(async () => {
    if (testAgent) {
      await deleteAgent(testAgent.id);
    }
  });

  it("returns generated prompt for agent", async () => {
    if (!testAgent) return;

    const res = await fetch(
      `${BASE}/api/admin/ai-agents/${testAgent.id}/prompt`,
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.prompt).toBeDefined();
    expect(typeof body.prompt).toBe("string");
    expect(body.prompt.length).toBeGreaterThan(0);
  });

  it("returns 404 for non-existent agent", async () => {
    const res = await fetch(`${BASE}/api/admin/ai-agents/nonexistent-id/prompt`);
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/ai-agents/[id]/avatar
// DELETE /api/admin/ai-agents/[id]/avatar
// ---------------------------------------------------------------------------

describe("POST/DELETE /api/admin/ai-agents/[id]/avatar", () => {
  let categoryId: string | null = null;
  let testAgent: { id: string; slug: string } | null = null;

  beforeAll(async () => {
    categoryId = await getFirstCategoryId();
    if (categoryId) {
      testAgent = await createTestAgent(categoryId, `avatar-${Date.now()}`);
    }
  });

  afterAll(async () => {
    if (testAgent) {
      await deleteAgent(testAgent.id);
    }
  });

  it("returns 400 when no file provided", async () => {
    if (!testAgent) return;

    const formData = new FormData();
    const res = await fetch(
      `${BASE}/api/admin/ai-agents/${testAgent.id}/avatar`,
      {
        method: "POST",
        body: formData,
      },
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when deleting avatar that does not exist", async () => {
    if (!testAgent) return;

    const res = await fetch(
      `${BASE}/api/admin/ai-agents/${testAgent.id}/avatar`,
      {
        method: "DELETE",
      },
    );

    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent agent", async () => {
    const formData = new FormData();
    const res = await fetch(`${BASE}/api/admin/ai-agents/nonexistent-id/avatar`, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(404);
  });
});
