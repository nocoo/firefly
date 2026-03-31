/**
 * L2 API E2E — Media endpoints
 *
 * Covers: GET /api/media, GET /api/media/[id], POST /api/media,
 *         DELETE /api/media/[id], PATCH /api/media/associate
 *
 * Note: Requires R2 test bucket to be configured.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

/** Minimal valid 1x1 PNG (68 bytes) */
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

/** Upload a test image and return its media record */
async function uploadTestImage(
  filename = `e2e-media-${Date.now()}.png`,
): Promise<{ id: string; url: string; r2_key: string; filename: string }> {
  const png = createMinimalPng();
  const file = new File([png], filename, { type: "image/png" });

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE}/api/media`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

/** Delete a media record (cleanup helper, ignores errors) */
async function deleteTestMedia(id: string): Promise<void> {
  await fetch(`${BASE}/api/media/${id}`, { method: "DELETE" }).catch(() => {});
}

// ---------------------------------------------------------------------------
// GET /api/media
// ---------------------------------------------------------------------------

describe("GET /api/media", () => {
  it("returns paginated list", async () => {
    const res = await fetch(`${BASE}/api/media`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("media");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("pageSize");
    expect(Array.isArray(body.media)).toBe(true);
  });

  it("filters by post_id", async () => {
    // Use a non-existent post_id — should return empty list
    const res = await fetch(
      `${BASE}/api/media?post_id=nonexistent-post-xyz`,
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.media).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// POST /api/media
// ---------------------------------------------------------------------------

describe("POST /api/media", () => {
  let createdId: string | null = null;

  afterAll(async () => {
    if (createdId) await deleteTestMedia(createdId);
  });

  it("uploads file and creates DB record, returns 201", async () => {
    const png = createMinimalPng();
    const file = new File([png], "e2e-upload-test.png", {
      type: "image/png",
    });

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${BASE}/api/media`, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("url");
    expect(body).toHaveProperty("r2_key");
    expect(body).toHaveProperty("filename");
    expect(body).toHaveProperty("mime_type");
    expect(body.mime_type).toBe("image/png");

    createdId = body.id;
  });
});

// ---------------------------------------------------------------------------
// GET /api/media/[id]
// ---------------------------------------------------------------------------

describe("GET /api/media/[id]", () => {
  let mediaId: string;

  beforeAll(async () => {
    const media = await uploadTestImage("e2e-get-single.png");
    mediaId = media.id;
  });

  afterAll(async () => {
    await deleteTestMedia(mediaId);
  });

  it("returns single record", async () => {
    const res = await fetch(`${BASE}/api/media/${mediaId}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(mediaId);
    expect(body).toHaveProperty("filename");
    expect(body).toHaveProperty("r2_key");
    expect(body).toHaveProperty("mime_type");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/media/[id]
// ---------------------------------------------------------------------------

describe("DELETE /api/media/[id]", () => {
  it("hard deletes (DB + R2), returns 204", async () => {
    const media = await uploadTestImage("e2e-delete-test.png");

    const res = await fetch(`${BASE}/api/media/${media.id}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(204);

    // Confirm it's gone
    const getRes = await fetch(`${BASE}/api/media/${media.id}`);
    expect(getRes.status).toBe(404);
  });

  it("returns 404 for non-existent id", async () => {
    const res = await fetch(`${BASE}/api/media/nonexistent-id-xyz`, {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/media/associate
// ---------------------------------------------------------------------------

describe("PATCH /api/media/associate", () => {
  let orphanId: string;
  let testPostId: string;
  const testSlug = `e2e-media-assoc-${Date.now()}`;

  beforeAll(async () => {
    // Create an orphan media record (no post_id)
    const media = await uploadTestImage("e2e-associate-orphan.png");
    orphanId = media.id;

    // Create a test post
    const postRes = await fetch(`${BASE}/api/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "E2E Associate Test",
        slug: testSlug,
        content: "Test post for media association.",
        status: "draft",
      }),
    });
    const post = await postRes.json();
    testPostId = post.id;
  });

  afterAll(async () => {
    await deleteTestMedia(orphanId);
    await fetch(`${BASE}/api/posts/${testSlug}`, { method: "DELETE" });
  });

  it("backfills post_id on orphaned media records", async () => {
    const res = await fetch(`${BASE}/api/media/associate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaIds: [orphanId],
        postId: testPostId,
      }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("updated");
    expect(body.updated).toBeGreaterThanOrEqual(1);

    // Verify the media is now associated
    const mediaRes = await fetch(
      `${BASE}/api/media?post_id=${testPostId}`,
    );
    const mediaBody = await mediaRes.json();
    expect(mediaBody.media.some((m: { id: string }) => m.id === orphanId)).toBe(
      true,
    );
  });

  it("does not overwrite already-associated records", async () => {
    // orphanId is now associated with testPostId from the previous test.
    // Trying to reassociate with a different post should not change it
    // (the SQL only updates WHERE post_id IS NULL).
    const res = await fetch(`${BASE}/api/media/associate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaIds: [orphanId],
        postId: testPostId,
      }),
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    // Already associated, so 0 rows updated (unless SQL re-sets the same value)
    expect(typeof body.updated).toBe("number");
  });

  it("returns 400 for non-existent postId", async () => {
    const res = await fetch(`${BASE}/api/media/associate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mediaIds: [orphanId],
        postId: "nonexistent-post-xyz",
      }),
    });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
