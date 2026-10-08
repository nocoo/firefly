/**
 * L2 API E2E — Settings endpoints
 *
 * Covers: GET /api/settings, PUT /api/settings
 *
 * Note: GET /api/settings is not proxy-protected (proxy only guards POST/PUT/DELETE/PATCH).
 * PUT /api/settings IS proxy-protected but E2E_SKIP_AUTH=true bypasses it.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

describe("GET /api/settings", () => {
  it("returns site settings", async () => {
    const res = await fetch(`${BASE}/api/settings`);
    expect(res.status).toBe(200);

    const body = await res.json();
    // Settings should have postsPerPage at minimum
    expect(body).toHaveProperty("postsPerPage");
  });
});

describe("PUT /api/settings", () => {
  it("round-trips WeChat settings and preserves unrelated fields on partial updates", async () => {
    const original = await (await fetch(`${BASE}/api/settings`)).json();
    const update = (body: unknown) => fetch(`${BASE}/api/settings`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    try {
      const response = await update({ wechat_name: "Configured account", wechat_qr_image_url: "/journal-wechat-qr.svg", wechat_avatar_url: "https://example.com/avatar.png" });
      expect(response.status).toBe(200);
      const settings = await response.json();
      expect(settings.wechatName).toBe("Configured account");
      expect(settings.wechatQrImageUrl).toBe("/journal-wechat-qr.svg");
      expect(settings.wechatAvatarUrl).toBe("https://example.com/avatar.png");
      expect(settings.siteName).toBe(original.siteName);
      const partial = await update({ wechat_avatar_url: "" });
      expect(partial.status).toBe(200);
      expect((await partial.json()).wechatName).toBe("Configured account");
    } finally {
      expect((await update({ wechat_name: original.wechatName, wechat_qr_image_url: original.wechatQrImageUrl, wechat_avatar_url: original.wechatAvatarUrl })).status).toBe(200);
    }
  });

  it.each([
    { wechat_qr_image_url: "javascript:alert(1)" },
    { wechat_avatar_url: "//example.com/avatar.png" },
    { wechat_qr_image_url: "data:image/png;base64,test" },
    { wechat_name: "x".repeat(256) },
    { wechat_name: null },
  ])("rejects invalid WeChat settings", async (body) => {
    const response = await fetch(`${BASE}/api/settings`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    expect(response.status).toBe(400);
  });

  it("updates postsPerPage setting", async () => {
    // Read current value
    const getRes = await fetch(`${BASE}/api/settings`);
    const original = await getRes.json();

    // Update to a different value
    const newValue = original.postsPerPage === 10 ? 15 : 10;
    const putRes = await fetch(`${BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postsPerPage: newValue }),
    });
    expect(putRes.status).toBe(200);

    const updated = await putRes.json();
    expect(updated.postsPerPage).toBe(newValue);

    // Restore original value
    await fetch(`${BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postsPerPage: original.postsPerPage }),
    });
  });

  it("rejects non-integer postsPerPage", async () => {
    const res = await fetch(`${BASE}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postsPerPage: "not-a-number" }),
    });
    expect(res.status).toBe(400);
  });
});
