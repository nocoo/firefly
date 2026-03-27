// ---------------------------------------------------------------------------
// Registration Engine — Unit Tests
// Verifies that registerEntityTools correctly registers tools on McpServer.
// ---------------------------------------------------------------------------

import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerEntityTools } from "./register";
import { createMockContext } from "./test-utils";
import type { EntityConfig } from "./types";

// ---------------------------------------------------------------------------
// Minimal mock entity
// ---------------------------------------------------------------------------

interface MockEntity {
  id: string;
  name: string;
  slug: string;
}

const mockEntity: MockEntity = { id: "m-1", name: "Test", slug: "test" };

function createTestConfig(
  overrides?: Partial<EntityConfig<MockEntity>>,
): EntityConfig<MockEntity> {
  return {
    name: "widget",
    display: "Widget",
    dataLayer: {
      list: vi.fn(async () => [mockEntity]),
      getById: vi.fn(async () => mockEntity),
      getBySlug: vi.fn(async () => mockEntity),
      create: vi.fn(async () => mockEntity),
      update: vi.fn(async () => mockEntity),
      delete: vi.fn(async () => true),
    },
    schemas: {
      create: { name: z.string() },
      update: { name: z.string().optional() },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("registerEntityTools", () => {
  it("registers 5 CRUD tools with default naming", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const ctx = createMockContext();
    const config = createTestConfig();

    registerEntityTools(server, config, ctx);

    // McpServer doesn't expose a public list of tools easily,
    // so we spy on server.tool to count calls.
    // Instead, verify by re-creating with spy:
    const server2 = new McpServer({ name: "test2", version: "0.0.1" });
    const toolSpy = vi.spyOn(server2, "tool");
    registerEntityTools(server2, config, ctx);

    expect(toolSpy).toHaveBeenCalledTimes(5);
    const toolNames = toolSpy.mock.calls.map((call) => call[0]);
    expect(toolNames).toEqual([
      "list_widgets",
      "get_widget",
      "create_widget",
      "update_widget",
      "delete_widget",
    ]);
  });

  it("uses custom plural name", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const toolSpy = vi.spyOn(server, "tool");
    const ctx = createMockContext();
    const config = createTestConfig({ plural: "gadgets" });

    registerEntityTools(server, config, ctx);

    const toolNames = toolSpy.mock.calls.map((call) => call[0]);
    expect(toolNames[0]).toBe("list_gadgets");
  });

  it("registers extra tools", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const toolSpy = vi.spyOn(server, "tool");
    const ctx = createMockContext();
    const handler = vi.fn();
    const config = createTestConfig({
      extraTools: [
        {
          name: "special_action",
          description: "Do something special",
          schema: { target: z.string() },
          handler,
        },
      ],
    });

    registerEntityTools(server, config, ctx);

    expect(toolSpy).toHaveBeenCalledTimes(6); // 5 CRUD + 1 extra
    const toolNames = toolSpy.mock.calls.map((call) => call[0]);
    expect(toolNames).toContain("special_action");
  });

  it("adds include param to list tool when projection is configured", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const toolSpy = vi.spyOn(server, "tool");
    const ctx = createMockContext();
    const config = createTestConfig({
      projection: {
        omit: ["heavy"],
        groups: { heavy: ["heavy"] },
      },
    });

    registerEntityTools(server, config, ctx);

    // The list tool schema (3rd arg) should have an include field
    const listCall = toolSpy.mock.calls.find((c) => c[0] === "list_widgets");
    expect(listCall).toBeDefined();
    const schema = listCall![2] as Record<string, unknown>;
    expect(schema).toHaveProperty("include");
  });

  it("registered callbacks delegate to handlers correctly", async () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const toolSpy = vi.spyOn(server, "tool");
    const ctx = createMockContext();
    const config = createTestConfig();

    registerEntityTools(server, config, ctx);

    // Extract the callback (4th arg) for each registered tool and invoke it
    for (const call of toolSpy.mock.calls) {
      const callback = call[3] as (args: Record<string, unknown>) => Promise<unknown>;
      // Each callback should not throw when called with valid-ish args
      const result = await callback({ id: "m-1" });
      expect(result).toBeDefined();
    }
  });

  it("extra tool callback delegates to handler", async () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const toolSpy = vi.spyOn(server, "tool");
    const ctx = createMockContext();
    const handler = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "ok" }],
    }));
    const config = createTestConfig({
      extraTools: [
        {
          name: "special_action",
          description: "Do something special",
          schema: { target: z.string() },
          handler,
        },
      ],
    });

    registerEntityTools(server, config, ctx);

    // Find the extra tool callback (last registered)
    const extraCall = toolSpy.mock.calls.find((c) => c[0] === "special_action");
    expect(extraCall).toBeDefined();
    const callback = extraCall![3] as (args: Record<string, unknown>) => Promise<unknown>;
    await callback({ target: "foo" });
    expect(handler).toHaveBeenCalledWith(ctx, { target: "foo" });
  });

  it("uses custom descriptions when provided", () => {
    const server = new McpServer({ name: "test", version: "0.0.1" });
    const toolSpy = vi.spyOn(server, "tool");
    const ctx = createMockContext();
    const config = createTestConfig({
      descriptions: { list: "Custom list description." },
    });

    registerEntityTools(server, config, ctx);

    const listCall = toolSpy.mock.calls.find((c) => c[0] === "list_widgets");
    expect(listCall![1]).toBe("Custom list description.");
  });
});
