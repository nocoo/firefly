import { describe, it, expect } from "vitest";
import { jsonResponse, errorResponse, notFoundResponse } from "./api";

describe("jsonResponse", () => {
  it("defaults to status 200 and serialises the body", async () => {
    const res = jsonResponse({ ok: true, count: 3 });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    await expect(res.json()).resolves.toEqual({ ok: true, count: 3 });
  });

  it("uses the provided status code", async () => {
    const res = jsonResponse({ created: true }, 201);
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ created: true });
  });
});

describe("errorResponse", () => {
  it("defaults to status 400 and wraps the message in { error }", async () => {
    const res = errorResponse("bad");
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "bad" });
  });

  it("uses the provided status code", async () => {
    const res = errorResponse("nope", 422);
    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({ error: "nope" });
  });
});

describe("notFoundResponse", () => {
  it("defaults to 'Resource not found' with status 404", async () => {
    const res = notFoundResponse();
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Resource not found" });
  });

  it("uses the supplied resource name", async () => {
    const res = notFoundResponse("Post");
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Post not found" });
  });
});
