/**
 * L2 API E2E — Upload endpoint
 *
 * Covers: POST /api/upload
 *
 * Note: R2 operations use the local filesystem adapter during E2E runs
 * (E2E_R2_LOCAL_DIR injected by the runner). No remote R2 bucket required.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

/** Minimal valid 1x1 PNG (68 bytes) */
function createMinimalPng(): Buffer {
  // PNG signature + IHDR + IDAT + IEND
  return Buffer.from(
    "89504e470d0a1a0a" + // PNG signature
      "0000000d49484452" + // IHDR chunk length + type
      "00000001" + // width: 1
      "00000001" + // height: 1
      "0802" + // bit depth: 8, color type: RGB
      "000000" + // compression, filter, interlace
      "907753de" + // IHDR CRC
      "0000000c4944415478" + // IDAT chunk
      "9c6260600000000400" +
      "01a035d918" + // IDAT data + CRC
      "0000000049454e44ae426082", // IEND
    "hex",
  );
}

describe("POST /api/upload", () => {
  it("uploads a valid PNG image", async () => {
    const png = createMinimalPng();
    const file = new File([png], "test-image.png", { type: "image/png" });

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${BASE}/api/upload`, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body).toHaveProperty("key");
    expect(body).toHaveProperty("url");
    expect(body).toHaveProperty("size");
    expect(body).toHaveProperty("mimeType");
    expect(body.mimeType).toBe("image/png");
    expect(typeof body.url).toBe("string");
    expect(body.url.length).toBeGreaterThan(0);
  });

  it("returns 400 when no file is provided", async () => {
    const formData = new FormData();

    const res = await fetch(`${BASE}/api/upload`, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 for unsupported MIME type", async () => {
    const file = new File(["not an image"], "test.txt", {
      type: "text/plain",
    });

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${BASE}/api/upload`, {
      method: "POST",
      body: formData,
    });

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
