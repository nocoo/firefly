/**
 * L2 API E2E — Upload Logo endpoint
 *
 * Covers: POST /api/upload/logo, DELETE /api/upload/logo
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

/**
 * Create a minimal valid 1x1 square PNG (68 bytes)
 */
function createMinimalPng(): Buffer {
  return Buffer.from(
    "89504e470d0a1a0a" +
      "0000000d49484452" +
      "00000001" +
      "00000001" +
      "0802" +
      "000000" +
      "907753de" +
      "0000000c4944415478" +
      "9c6260600000000400" +
      "01a035d918" +
      "0000000049454e44ae426082",
    "hex",
  );
}


// ---------------------------------------------------------------------------
// POST /api/upload/logo
// ---------------------------------------------------------------------------

describe("POST /api/upload/logo", () => {
  it("returns 400 when no file provided", async () => {
    const formData = new FormData();

    const res = await fetch(`${BASE}/api/upload/logo`, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No file");
  });

  it("returns 400 for non-image file", async () => {
    const file = new File(["not an image"], "test.txt", { type: "text/plain" });
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${BASE}/api/upload/logo`, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("uploads a square PNG and returns 201", async () => {
    const png = createMinimalPng();
    const file = new File([png], "logo.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${BASE}/api/upload/logo`, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("version");
    expect(body).toHaveProperty("sizes");
    expect(Array.isArray(body.sizes)).toBe(true);
    expect(body.sizes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/upload/logo
// ---------------------------------------------------------------------------

describe("DELETE /api/upload/logo", () => {
  it("removes logo and returns 200", async () => {
    // First ensure there's a logo to remove
    const png = createMinimalPng();
    const file = new File([png], "logo.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("file", file);

    await fetch(`${BASE}/api/upload/logo`, {
      method: "POST",
      body: formData,
    });

    // Now delete
    const res = await fetch(`${BASE}/api/upload/logo`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.removed).toBe(true);
  });

  it("returns 404 when no logo exists", async () => {
    // First ensure no logo exists
    await fetch(`${BASE}/api/upload/logo`, { method: "DELETE" }).catch(
      () => {},
    );

    // Try to delete again
    const res = await fetch(`${BASE}/api/upload/logo`, {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("No logo");
  });
});
