import { describe, it, expect } from "vitest";

import pkg from "../../../../../package.json";

import { GET } from "./route";

describe("GET /.well-known/mcp/server-card.json", () => {
  it("returns 200 with JSON content type", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("sets Cache-Control header for 1 hour", () => {
    const response = GET();
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=3600",
    );
  });

  it("advertises serverInfo with name and dynamic package version", async () => {
    const response = GET();
    const body = await response.json();
    expect(body.serverInfo).toEqual({
      name: "firefly",
      version: pkg.version,
    });
  });

  it("advertises streamable-http transport pointing at /api/mcp", async () => {
    const response = GET();
    const body = await response.json();
    expect(body.transport).toEqual({
      type: "streamable-http",
      endpoint: "/api/mcp",
    });
  });

  it("advertises capabilities (tools + resources, no prompts)", async () => {
    const response = GET();
    const body = await response.json();
    expect(body.capabilities).toEqual({
      tools: true,
      resources: true,
      prompts: false,
    });
  });
});
