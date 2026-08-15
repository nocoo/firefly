import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";

vi.mock("@/data/settings", () => ({
  getSiteSettings: vi.fn(),
}));

vi.mock("@/data/entities/human", () => ({
  getDefaultHuman: vi.fn(),
}));

import { getSiteSettings } from "@/data/settings";
import { getDefaultHuman } from "@/data/entities/human";
import { loadSiteIdentity } from "./site-identity";

const settings = {
  postsPerPage: 10,
  commentsEnabled: false,
  fontStyle: "pingfang" as const,
  siteLogoVersion: null,
  siteName: "Firefly",
  siteTagline: "",
  siteDescription: "",
  defaultHumanId: "human-1",
  authorEmail: "ed@example.com",
  twitterHandle: "",
  socialLinks: [],
  updatedAt: 1,
};

describe("loadSiteIdentity", () => {
  let db: Db;

  beforeEach(() => {
    db = createMockDb();
    vi.clearAllMocks();
  });

  it("uses the provided settings and default human name", async () => {
    vi.mocked(getDefaultHuman).mockResolvedValue({
      id: "human-1",
      name: "Li Zheng",
    } as never);

    const result = await loadSiteIdentity(db, settings);

    expect(getSiteSettings).not.toHaveBeenCalled();
    expect(result.settings).toBe(settings);
    expect(result.identity.siteAuthor).toBe("Li Zheng");
    expect(result.identity.siteName).toBe("Firefly");
  });

  it("loads settings and falls back to siteName when no default human", async () => {
    vi.mocked(getSiteSettings).mockResolvedValue(settings);
    vi.mocked(getDefaultHuman).mockResolvedValue(null);

    const result = await loadSiteIdentity(db);

    expect(getSiteSettings).toHaveBeenCalledWith(db);
    expect(result.identity.siteAuthor).toBe("Firefly");
  });
});
