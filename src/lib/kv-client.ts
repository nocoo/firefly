// ---------------------------------------------------------------------------
// Cloudflare KV REST API Client
// Railway cannot directly bind KV, so we access it via REST API.
// ---------------------------------------------------------------------------

/**
 * Options for KV put operations.
 */
export interface KVPutOptions {
  /** TTL in seconds. If set, the key will expire after this many seconds. */
  expirationTtl?: number;
}

/**
 * KV client interface for Cloudflare KV operations.
 */
export interface KVClient {
  /** Get a value by key. Returns null if not found. */
  get<T>(key: string): Promise<T | null>;
  /** Put a value with optional TTL. */
  put(key: string, value: unknown, options?: KVPutOptions): Promise<void>;
  /** Delete a key. No-op if key doesn't exist. */
  delete(key: string): Promise<void>;
  /** List keys with optional prefix filter. */
  list(prefix?: string): Promise<string[]>;
}

/**
 * Create a KV client for the given Cloudflare account and namespace.
 *
 * @param accountId - Cloudflare account ID
 * @param namespaceId - KV namespace ID
 * @param apiToken - API token with KV read/write permissions
 */
export function createKVClient(
  accountId: string,
  namespaceId: string,
  apiToken: string,
): KVClient {
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`;

  return {
    async get<T>(key: string): Promise<T | null> {
      const res = await fetch(
        `${baseUrl}/values/${encodeURIComponent(key)}`,
        {
          headers: { Authorization: `Bearer ${apiToken}` },
        },
      );
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(`KV get failed: ${res.status}`);
      }
      return res.json() as Promise<T>;
    },

    async put(key: string, value: unknown, options?: KVPutOptions): Promise<void> {
      const url = new URL(`${baseUrl}/values/${encodeURIComponent(key)}`);
      if (options?.expirationTtl) {
        url.searchParams.set("expiration_ttl", String(options.expirationTtl));
      }
      const res = await fetch(url.toString(), {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(value),
      });
      if (!res.ok) {
        throw new Error(`KV put failed: ${res.status}`);
      }
    },

    async delete(key: string): Promise<void> {
      const res = await fetch(
        `${baseUrl}/values/${encodeURIComponent(key)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${apiToken}` },
        },
      );
      // 404 is acceptable - key may not exist
      if (!res.ok && res.status !== 404) {
        throw new Error(`KV delete failed: ${res.status}`);
      }
    },

    async list(prefix?: string): Promise<string[]> {
      const url = new URL(`${baseUrl}/keys`);
      if (prefix) {
        url.searchParams.set("prefix", prefix);
      }
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (!res.ok) {
        throw new Error(`KV list failed: ${res.status}`);
      }
      const data = (await res.json()) as { result: { name: string }[] };
      return data.result.map((k) => k.name);
    },
  };
}
