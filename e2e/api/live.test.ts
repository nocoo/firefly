const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

describe("GET /api/live", () => {
  it("returns 200 with surety-standard fields", async () => {
    const res = await fetch(`${BASE}/api/live`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.version).toBe("string");
    expect(body.component).toBe("firefly");
    expect(typeof body.timestamp).toBe("string");
    expect(typeof body.uptime).toBe("number");
    expect(body.database).toEqual({ connected: true });
  });

  it("sets Cache-Control: no-store", async () => {
    const res = await fetch(`${BASE}/api/live`);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
