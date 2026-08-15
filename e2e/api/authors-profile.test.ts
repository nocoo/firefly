/**
 * L2 API E2E — public human profile lookup
 *
 * Unauthenticated. Default humans are not public, so the empty payload is
 * the expected result unless a test explicitly opts a human in.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

describe("GET /api/authors/profile", () => {
  it("returns an empty payload without a cookie", async () => {
    const res = await fetch(`${BASE}/api/authors/profile?email=nobody@example.com`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ name: null, avatar: null });
  });

  it("returns an empty payload when the default human is not public", async () => {
    const list = await fetch(`${BASE}/api/admin/authors`);
    const body = await list.json();
    const def = body.authors.find((a: { is_default: number }) => a.is_default === 1);
    expect(def).toBeTruthy();
    expect(def.profile_public).toBe(0);

    const res = await fetch(
      `${BASE}/api/authors/profile?email=${encodeURIComponent(def.email ?? "missing@example.com")}`,
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ name: null, avatar: null });
  });
});
