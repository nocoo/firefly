import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashIp } from "./hash";

describe("hashIp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00Z"));
  });

  it("returns a hex string", async () => {
    const hash = await hashIp("192.168.1.1");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces same hash for same IP on same day", async () => {
    const hash1 = await hashIp("10.0.0.1");
    const hash2 = await hashIp("10.0.0.1");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different IPs", async () => {
    const hash1 = await hashIp("10.0.0.1");
    const hash2 = await hashIp("10.0.0.2");
    expect(hash1).not.toBe(hash2);
  });

  it("produces different hash for same IP on different day", async () => {
    const hash1 = await hashIp("10.0.0.1");
    vi.setSystemTime(new Date("2026-03-24T12:00:00Z"));
    const hash2 = await hashIp("10.0.0.1");
    expect(hash1).not.toBe(hash2);
  });
});
