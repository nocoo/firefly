const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

describe("GET /api/live", () => {
  it("returns 200 with expected body", async () => {
    const res = await fetch(`${BASE}/api/live`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.version).toBe("string");
    expect(body.component).toBe("firefly");
  });

  it("sets Cache-Control: no-store", async () => {
    const res = await fetch(`${BASE}/api/live`);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
