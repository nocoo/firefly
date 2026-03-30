/**
 * L2 API E2E — URL unfurl endpoint
 *
 * Covers: POST /api/unfurl
 *
 * Tests SSRF protection (400 errors), missing/invalid URL (400),
 * success path (200 with response shape), and method guard (405).
 *
 * The success test requires outbound HTTP **from the server**.
 * If the server cannot reach example.com, the test is marked as
 * `skip` so CI reports surface the gap (not silently passing).
 */
import { it, expect, describe } from "vitest";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

describe("POST /api/unfurl", () => {
  it("returns 400 when url is missing", async () => {
    const res = await fetch(`${BASE}/api/unfurl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/url is required/i);
  });

  it("returns 400 when url is empty string", async () => {
    const res = await fetch(`${BASE}/api/unfurl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "  " }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/url is required/i);
  });

  it("returns 400 for file: protocol (SSRF)", async () => {
    const res = await fetch(`${BASE}/api/unfurl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "file:///etc/passwd" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not permitted/i);
  });

  it("returns 400 for localhost (SSRF)", async () => {
    const res = await fetch(`${BASE}/api/unfurl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "http://localhost:3000" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/private network/i);
  });

  it("returns 400 for 192.168.x.x (SSRF)", async () => {
    const res = await fetch(`${BASE}/api/unfurl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "http://192.168.1.1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/private network/i);
  });

  it("returns 400 for 127.0.0.1 (SSRF)", async () => {
    const res = await fetch(`${BASE}/api/unfurl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "http://127.0.0.1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/private network/i);
  });

  it("returns 400 for invalid URL format", async () => {
    const res = await fetch(`${BASE}/api/unfurl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "not-a-valid-url" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid url/i);
  });

  it("returns 200 with metadata for a valid URL (requires server outbound HTTP)", async (ctx) => {
    const res = await fetch(`${BASE}/api/unfurl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });

    // Only skip when the *server* genuinely cannot reach the external URL
    // (outbound network failure). Any other non-200 is a real regression.
    if (res.status !== 200) {
      const body = await res.json();
      const isOutboundFailure =
        res.status === 502 &&
        /failed to fetch url|dns resolution failed/i.test(body.error ?? "");
      if (isOutboundFailure) {
        // eslint-disable-next-line no-restricted-syntax -- runtime conditional skip, not a forgotten .only/.skip
        ctx.skip();
        return;
      }
      // Any other non-200 (400, 403, 500, …) is unexpected → fail loudly
      expect.fail(`Expected 200 but got ${res.status}: ${JSON.stringify(body)}`);
    }

    const body = await res.json();
    // Verify response shape
    expect(body).toHaveProperty("url");
    expect(body).toHaveProperty("title");
    expect(body).toHaveProperty("description");
    expect(body).toHaveProperty("image");
    expect(body).toHaveProperty("bodyText");

    // Validate field types and values
    expect(body.url).toBe("https://example.com");
    expect(typeof body.title).toBe("string");
    expect(body.title.length).toBeGreaterThan(0);
    expect(typeof body.bodyText).toBe("string");
    // image can be string or null
    expect(body.image === null || typeof body.image === "string").toBe(true);
  }, 15_000);
});

describe("GET /api/unfurl", () => {
  it("returns 405 for GET requests", async () => {
    const res = await fetch(`${BASE}/api/unfurl`);
    expect(res.status).toBe(405);
  });
});
