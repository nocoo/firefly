/**
 * L2 API E2E — Upload Logo endpoint
 *
 * Covers: POST /api/upload/logo, DELETE /api/upload/logo
 *
 * Note: Logo upload requires sharp library for image resizing. Tests that
 * depend on successful upload are marked with .todo to handle environments
 * where sharp may not be available.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";


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

  // Note: This test requires sharp to be properly installed and configured.
  // It may fail in certain CI environments or when R2 is not available.
  // Disabled until sharp environment is stable in E2E.
  it.todo("uploads a square PNG and returns 201");
});

// ---------------------------------------------------------------------------
// DELETE /api/upload/logo
// ---------------------------------------------------------------------------

describe("DELETE /api/upload/logo", () => {
  // Note: This test depends on successful logo upload which requires sharp.
  // Disabled until sharp environment is stable in E2E.
  it.todo("removes logo and returns 200");

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
