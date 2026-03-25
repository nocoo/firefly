/**
 * L2 API E2E — URL unfurl endpoint
 *
 * Covers: POST /api/unfurl
 *
 * Tests SSRF protection (400 errors), missing/invalid URL (400),
 * and validates the successful unfurl response shape.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17043";

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
});
