/**
 * In-route auth check for /api/media/[id] — defense in depth.
 *
 * The proxy middleware also enforces auth on /api/media routes (see proxy.ts
 * authGuard / isProtectedApiRoute), but a regression in skipStaticAssets once
 * let DELETE /api/media/<uuid>.png bypass authGuard entirely. These tests
 * pin that the route handler itself fails closed when the session is missing,
 * regardless of whether the proxy ran.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@/lib/r2-client", () => ({ getR2ClientAdapter: vi.fn(() => ({})) }));
vi.mock("@/data/entities/media", () => ({ getMediaById: vi.fn() }));
vi.mock("@/services/media-service", () => ({
  MediaService: { delete: vi.fn() },
}));

import { auth } from "@/lib/auth";
import { getMediaById } from "@/data/entities/media";
import { MediaService } from "@/services/media-service";
import { GET, DELETE } from "./route";

const fakeParams = { params: Promise.resolve({ id: "media-1" }) };
const fakeRequest = {} as never;

describe("GET /api/media/[id] — in-route auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET(fakeRequest, fakeParams);

    expect(response.status).toBe(401);
    expect(getMediaById).not.toHaveBeenCalled();
  });

  it("returns 401 when session has no user", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth).mockResolvedValue({} as any);

    const response = await GET(fakeRequest, fakeParams);

    expect(response.status).toBe(401);
    expect(getMediaById).not.toHaveBeenCalled();
  });

  it("reaches data layer when authenticated", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth).mockResolvedValue({ user: { email: "admin@example.com" } } as any);
    vi.mocked(getMediaById).mockResolvedValue(null);

    const response = await GET(fakeRequest, fakeParams);

    expect(getMediaById).toHaveBeenCalled();
    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/media/[id] — in-route auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no session (does not call MediaService.delete)", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await DELETE(fakeRequest, fakeParams);

    expect(response.status).toBe(401);
    expect(getMediaById).not.toHaveBeenCalled();
    expect(MediaService.delete).not.toHaveBeenCalled();
  });

  it("reaches data layer when authenticated", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(auth).mockResolvedValue({ user: { email: "admin@example.com" } } as any);
    vi.mocked(getMediaById).mockResolvedValue(null);

    const response = await DELETE(fakeRequest, fakeParams);

    expect(getMediaById).toHaveBeenCalled();
    expect(response.status).toBe(404);
  });
});
