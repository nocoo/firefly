/**
 * L2 API E2E — System endpoints
 *
 * Covers: GET /api/system/memory
 *
 * Note: This endpoint requires authentication. In E2E_SKIP_AUTH mode,
 * it should return the memory stats.
 */
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17028";

// ---------------------------------------------------------------------------
// GET /api/system/memory
// ---------------------------------------------------------------------------

describe("GET /api/system/memory", () => {
  it("returns memory stats", async () => {
    const res = await fetch(`${BASE}/api/system/memory`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("memory");
    expect(body.memory).toHaveProperty("current");
    expect(body.memory).toHaveProperty("history");
    expect(body.memory).toHaveProperty("summary");

    // Verify summary structure
    const { summary } = body.memory;
    expect(summary).toHaveProperty("peakHeapMB");
    expect(summary).toHaveProperty("avgHeapMB");
    expect(summary).toHaveProperty("sampleCount");
    expect(summary).toHaveProperty("collectionStarted");
    expect(summary).toHaveProperty("uptimeSeconds");

    // Values should be numbers
    expect(typeof summary.peakHeapMB).toBe("number");
    expect(typeof summary.avgHeapMB).toBe("number");
    expect(typeof summary.uptimeSeconds).toBe("number");
  });
});
