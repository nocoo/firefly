import { describe, it, expect, vi, beforeEach } from "vitest";
import { createKVClient, type KVClient } from "./kv-client";

describe("createKVClient", () => {
  const accountId = "test-account";
  const namespaceId = "test-namespace";
  const apiToken = "test-token";
  let client: KVClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    client = createKVClient(accountId, namespaceId, apiToken);
  });

  describe("get", () => {
    it("returns parsed JSON for existing key", async () => {
      const data = { foo: "bar", count: 42 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data),
      });

      const result = await client.get<typeof data>("test-key");

      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/test-key`,
        { headers: { Authorization: `Bearer ${apiToken}` } },
      );
    });

    it("returns null for 404", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await client.get("missing-key");

      expect(result).toBeNull();
    });

    it("throws on non-404 error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(client.get("error-key")).rejects.toThrow("KV get failed: 500");
    });

    it("encodes special characters in key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve("value"),
      });

      await client.get("key/with/slashes");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("key%2Fwith%2Fslashes"),
        expect.any(Object),
      );
    });
  });

  describe("put", () => {
    it("sends JSON body with correct headers", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const value = { nested: { data: true } };

      await client.put("key", value);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/values/key"),
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(value),
        },
      );
    });

    it("includes expiration_ttl when provided", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.put("key", "value", { expirationTtl: 3600 });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("expiration_ttl=3600");
    });

    it("does not include expiration_ttl when not provided", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.put("key", "value");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain("expiration_ttl");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

      await expect(client.put("key", "value")).rejects.toThrow("KV put failed: 403");
    });

    it("serializes primitive values correctly", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.put("number-key", 12345);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: "12345",
        }),
      );
    });
  });

  describe("delete", () => {
    it("sends DELETE request", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.delete("key-to-delete");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/values/key-to-delete"),
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${apiToken}` },
        },
      );
    });

    it("does not throw on 404 (key not found)", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      await expect(client.delete("missing-key")).resolves.toBeUndefined();
    });

    it("throws on non-404 error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(client.delete("error-key")).rejects.toThrow("KV delete failed: 500");
    });
  });

  describe("list", () => {
    it("returns array of key names", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result: [{ name: "key1" }, { name: "key2" }, { name: "key3" }],
          }),
      });

      const keys = await client.list();

      expect(keys).toEqual(["key1", "key2", "key3"]);
    });

    it("includes prefix in query string when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: [] }),
      });

      await client.list("cache:");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("prefix=cache%3A");
    });

    it("does not include prefix when not provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: [] }),
      });

      await client.list();

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain("prefix=");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      await expect(client.list()).rejects.toThrow("KV list failed: 401");
    });
  });
});
