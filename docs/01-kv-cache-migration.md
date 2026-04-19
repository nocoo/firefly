# KV Cache Migration Plan

将 Next.js 页面缓存迁移到 Cloudflare KV，降低运行时内存占用，同时保持性能和现有语义。

## 背景

当前 firefly 使用自定义 `cache-handler.ts` 将 Next.js ISR/fetch 缓存存储在进程内存中。长时间运行后：

- 内存占用持续增长（页面缓存累积）
- 重启后缓存全部丢失，需要重新预热
- 无法跨实例共享缓存

### 现状

`next.config.ts` 已配置：
```typescript
cacheHandler: require.resolve("./src/lib/cache-handler.js"),
cacheMaxMemorySize: 0, // 禁用 Next.js 内置缓存
```

自定义 cache handler 完全接管缓存，但当前是纯内存存储。

## 目标

1. **降低内存占用**：冷数据存储到 Cloudflare KV
2. **保持性能**：热数据保留在内存 LRU
3. **缓存持久化**：重启后可从 KV 恢复热门页面（best-effort，见限制说明）
4. **保留现有语义**：ISR stale-while-revalidate、tag invalidation、监控面板

## 部署约束

**单实例假设**：本方案假设 Railway 部署为单实例。多实例部署需要额外的协调机制（如分布式锁或 CAS），超出本计划范围。

## KV Namespace

| 环境 | Namespace | ID |
|------|-----------|-----|
| Production | `lizhengblog` | `4246634d54b243d2a9b29c9317a2eb68` |
| Test (E2E) | `lizhengblog-test` | `dca9e942f1ff4739bf5c8d2f28ac2ea0` |

环境变量：
```bash
# .env.local / Railway
CF_ACCOUNT_ID=xxx          # 已有
CF_API_TOKEN=xxx           # 需新增，KV 读写权限
KV_NAMESPACE_ID=4246634d54b243d2a9b29c9317a2eb68

# .env.test
KV_NAMESPACE_ID=dca9e942f1ff4739bf5c8d2f28ac2ea0
```

## 架构变更

### 现状

```
┌─────────────────────────────────────────────────┐
│                 Next.js (Railway)               │
│  ┌─────────────────────────────────────────┐    │
│  │       cache-handler.ts (in-memory)      │    │
│  │  - Map<string, UnifiedEntry>            │    │
│  │  - 页面缓存、fetch 缓存、tag 缓存       │    │
│  └─────────────────────────────────────────┘    │
│                        │                        │
│                        ▼                        │
│              process.memoryUsage()              │
└─────────────────────────────────────────────────┘
```

### 目标

```
┌─────────────────────────────────────────────────┐
│                 Next.js (Railway)               │
│  ┌─────────────────────────────────────────┐    │
│  │       cache-handler.ts (双层缓存)       │    │
│  │  - 热数据：LRU in-memory (容量受限)     │    │
│  │  - 冷数据：Cloudflare KV (持久化)       │    │
│  └─────────────────────────────────────────┘    │
│                        │                        │
│                        ▼                        │
│              Cloudflare KV (边缘)               │
│              lizhengblog namespace              │
└─────────────────────────────────────────────────┘
```

## 关键设计决策

### 1. KV 存储结构 (Envelope)

KV 必须存储完整的 `UnifiedEntry`，不能只存 value：

```typescript
// KV 存储的完整结构（与现有 UnifiedEntry 一致）
interface KVStoredEntry {
  // CacheHandlerValue 必需字段
  lastModified: number;
  value: any;
  
  // 元数据（监控、tag 失效依赖）
  kind: string;
  size: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  tags: string[];
  revalidate: number | null;
}
```

**理由**：
- `lastModified` — Next.js 用于判断 stale-while-revalidate
- `tags` — `revalidateTag()` 需要知道每个 entry 关联的 tags
- `kind/size/accessCount` — `/api/system/memory` 监控面板依赖

### 2. KV TTL 策略：统一 7 天过期

所有 KV 数据（cache entry 和 tag 时间戳）都使用 7 天 TTL：

```typescript
const KV_TTL_SECONDS = 7 * 24 * 3600; // 7 days

// Cache entry
await kvClient.put(`cache:${key}`, entry, { expirationTtl: KV_TTL_SECONDS });

// Tag 时间戳
await kvClient.put(`tag:${tag}`, timestamp, { expirationTtl: KV_TTL_SECONDS });
```

**为什么不用 `revalidate` 作为 TTL**：

ISR 的 stale-while-revalidate 语义要求即使 entry 过了 `revalidate` 时间也要返回旧值。如果把 `revalidate` 当 TTL，entry 一过期就物理删除，会把 ISR 退化成冷 miss。

**为什么 cache entry 需要 TTL**：

tag 时间戳必须有 TTL 防止无限增长，但这会导致一个问题：
- 假设 cache entry 无 TTL，tag 时间戳 7 天后过期
- 此时一个 8 天前失效的 entry 会被误判为"有效"（tag 记录不存在 → 没有失效记录 → 有效）

解决方案：cache entry TTL ≤ tag TTL。两者都用 7 天，保证：
- 频繁访问的页面：每次 `set()` 刷新 TTL，不会过期
- 7 天无访问的页面：从 KV 过期，下次访问重新生成（符合"冷数据"定义）

### 3. 监控面板迁移

`/api/system/memory` 调用 `getCacheStats()` 展示缓存状态。迁移后需要：

```typescript
export function getCacheStats(): CacheStats {
  // LRU 热数据（同步可读）
  const lruStats = getLRUStats();
  
  // KV 冷数据统计（需要异步，或者维护本地计数器）
  // 方案 A：只展示 LRU stats + "KV entries exist"
  // 方案 B：维护 kvEntryCount 计数器，每次 put/delete 更新
  
  return {
    ...lruStats,
    kvBackend: {
      enabled: true,
      // 无法同步获取 KV 条目数，用计数器近似
      estimatedEntries: kvEntryCounter,
    },
  };
}
```

**建议方案**：Phase 2 先用方案 A（只展示 LRU stats），Phase 3 再考虑 KV stats。

### 4. Tag Invalidation

现有逻辑：
```typescript
const tagRevalidatedAt = new Map<string, number>();

async revalidateTag(tags: string[]) {
  // 1. 记录 tag 失效时间
  for (const tag of tags) {
    tagRevalidatedAt.set(tag, Date.now());
  }
  // 2. 立即删除匹配的内存 entry
  for (const [key, entry] of cache.entries()) {
    if (entry.tags.some(t => tags.includes(t))) {
      cache.delete(key);
    }
  }
}
```

**迁移方案：每个 tag 单独存储**

为避免多实例覆盖和无限增长，每个 tag 时间戳存为独立 KV key：

```typescript
// KV key 格式: tag:{tagName} → timestamp
// 例如: tag:post-123 → 1713456789000

async revalidateTag(tags: string[]) {
  const now = Date.now();
  const kv = getKVClient();
  
  // 1. 更新内存 tag 时间戳
  for (const tag of tags) {
    tagRevalidatedAt.set(tag, now);
  }
  
  // 2. 清除内存 LRU
  for (const [key, entry] of lruCache.entries()) {
    if (entry.tags.some(t => tags.includes(t))) {
      lruCache.delete(key);
    }
  }
  
  // 3. 每个 tag 单独写入 KV（并行）
  if (kv) {
    await Promise.all(
      tags.map(tag => kv.put(`tag:${tag}`, now))
    );
  }
}
```

**get() 时检查 tag 失效**：
```typescript
async get(key: string): Promise<CacheHandlerValue | null> {
  // ... 获取 entry ...
  
  // 检查 tag 失效（先查内存，miss 则查 KV）
  for (const tag of entry.tags) {
    let revalidatedTime = tagRevalidatedAt.get(tag);
    
    // 内存没有 → 从 KV 加载
    if (revalidatedTime === undefined) {
      const kv = getKVClient();
      if (kv) {
        const kvTime = await kv.get<number>(`tag:${tag}`);
        if (kvTime !== null) {
          tagRevalidatedAt.set(tag, kvTime); // 缓存到内存
          revalidatedTime = kvTime;
        }
      }
    }
    
    if (revalidatedTime && revalidatedTime > entry.lastModified) {
      // Entry stale，删除并返回 null
      lruCache.delete(key);
      getKVClient()?.delete(`cache:${key}`).catch(() => {});
      return null;
    }
  }
  // ...
}
```

**GC 策略**：tag 时间戳和 cache entry 都使用 KV TTL 自动过期。

```typescript
// Tag 时间戳：7 天 TTL
await kv.put(`tag:${tag}`, now, { expirationTtl: 7 * 24 * 3600 });

// Cache entry：也用 7 天 TTL（与 tag TTL 一致）
await kv.put(`cache:${key}`, entry, { expirationTtl: 7 * 24 * 3600 });
```

**TTL 约束**：cache entry TTL ≤ tag TTL，否则会出现"复活"问题：
- 如果 cache entry 存活时间超过 tag 时间戳，tag 过期后 entry 会被误判为有效
- 两者使用相同 TTL（7 天）保证：tag 过期时，相关 entry 也已过期或即将过期

**注意**：这意味着 KV 中的 cache entry 最多存活 7 天。对于长期稳定的页面：
- 7 天内会被访问 → 每次 `set()` 刷新 TTL
- 7 天无访问 → 从 KV 过期，下次访问重新生成
- 这符合"冷数据"的定义：长期无访问的页面不需要持久化

### 5. KV 写入语义：Best-Effort 持久化

`set()` 使用 fire-and-forget 写入 KV：

```typescript
// 写入 KV（fire-and-forget，失败不阻塞）
getKVClient()?.put(`cache:${key}`, entry).catch(err => {
  console.error(`[cache] KV put failed for ${key}:`, err.message);
});
```

**明确的 trade-off**：

| 场景 | 行为 |
|------|------|
| 正常运行 | KV 写入在后台完成，响应不阻塞 |
| KV 暂时不可用 | 写入失败，entry 只存在于 LRU，重启后丢失 |
| 实例在 put() 完成前退出 | 新生成的缓存不会落到 KV |

**设计理由**：
1. **性能优先**：KV 写入延迟 ~10ms，同步写入会增加每个 ISR 响应的 TTFB
2. **缓存本质**：缓存丢失是可接受的——Next.js 会重新生成
3. **符合现状**：当前纯内存缓存重启也会丢失，KV 是增量改进而非强一致性保证

**"重启不丢失热门页面"的正确理解**：
- 在正常运行期间写入 KV 的页面可以恢复
- 写入期间崩溃/重启的页面可能丢失
- 这是 best-effort，不是持久化保证

如需强一致性，可改为同步写入，但会牺牲响应延迟。

## 实施计划

### Phase 1: KV Client 封装

**文件**: `src/lib/kv-client.ts`

```typescript
// KV client using Cloudflare REST API
// Railway 无法直接绑定 KV，通过 REST API 访问

export interface KVPutOptions {
  expirationTtl?: number; // TTL in seconds (for tag timestamps)
}

export interface KVClient {
  get<T>(key: string): Promise<T | null>;
  put(key: string, value: unknown, options?: KVPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export function createKVClient(
  accountId: string,
  namespaceId: string,
  apiToken: string
): KVClient {
  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`;
  
  return {
    async get<T>(key: string): Promise<T | null> {
      const res = await fetch(`${baseUrl}/values/${encodeURIComponent(key)}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`KV get failed: ${res.status}`);
      return res.json() as T;
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
      if (!res.ok) throw new Error(`KV put failed: ${res.status}`);
    },
    
    async delete(key: string): Promise<void> {
      const res = await fetch(`${baseUrl}/values/${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (!res.ok && res.status !== 404) {
        throw new Error(`KV delete failed: ${res.status}`);
      }
    },
    
    async list(prefix?: string): Promise<string[]> {
      const url = new URL(`${baseUrl}/keys`);
      if (prefix) url.searchParams.set("prefix", prefix);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (!res.ok) throw new Error(`KV list failed: ${res.status}`);
      const data = await res.json() as { result: { name: string }[] };
      return data.result.map(k => k.name);
    },
  };
}
```

### Phase 2: Cache Handler 双层改造

**改造点**：

1. 新增 LRU 容量限制（如 100 条或 50MB）
2. `get()` 先查 LRU，miss 查 KV，命中后回填 LRU
3. `get()` 检查 tag 失效时，lazy load tag 时间戳从 KV
4. `set()` 同时写入 LRU 和 KV（fire-and-forget）
5. `revalidateTag()` 清理 LRU + 每个 tag 单独写入 KV（带 7 天 TTL）

```typescript
import { createKVClient, type KVClient } from "./kv-client";
import { LRUCache } from "lru-cache";

// LRU 配置
const LRU_MAX_ENTRIES = 100;
const KV_TTL_SECONDS = 7 * 24 * 3600; // 7 days

// 双层缓存
const lruCache = new LRUCache<string, UnifiedEntry>({ max: LRU_MAX_ENTRIES });
const tagRevalidatedAt = new Map<string, number>();
let kvClient: KVClient | null = null;

function getKVClient(): KVClient | null {
  if (kvClient) return kvClient;
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  const namespaceId = process.env.KV_NAMESPACE_ID;
  if (!accountId || !apiToken || !namespaceId) return null;
  kvClient = createKVClient(accountId, namespaceId, apiToken);
  return kvClient;
}

export default class CacheHandler {
  async get(key: string): Promise<CacheHandlerValue | null> {
    // 1. 查 LRU
    let entry = lruCache.get(key);
    
    // 2. LRU miss → 查 KV
    if (!entry) {
      const kv = getKVClient();
      if (kv) {
        const kvEntry = await kv.get<UnifiedEntry>(`cache:${key}`);
        if (kvEntry) {
          entry = kvEntry;
          lruCache.set(key, entry); // 回填 LRU
        }
      }
    }
    
    if (!entry) return null;
    
    // 3. 检查 tag 失效（先查内存，miss 则查 KV）
    for (const tag of entry.tags) {
      let revalidatedTime = tagRevalidatedAt.get(tag);
      
      // 内存没有 → 从 KV lazy-load
      if (revalidatedTime === undefined) {
        const kv = getKVClient();
        if (kv) {
          const kvTime = await kv.get<number>(`tag:${tag}`);
          if (kvTime !== null) {
            tagRevalidatedAt.set(tag, kvTime); // 缓存到内存
            revalidatedTime = kvTime;
          }
        }
      }
      
      if (revalidatedTime && revalidatedTime > entry.lastModified) {
        lruCache.delete(key);
        // Lazy: 也从 KV 删除
        getKVClient()?.delete(`cache:${key}`).catch(() => {});
        return null;
      }
    }
    
    // 4. 更新访问元数据
    entry.lastAccessedAt = Date.now();
    entry.accessCount += 1;
    
    return { lastModified: entry.lastModified, value: entry.value };
  }
  
  async set(key: string, data: any, ctx?: any): Promise<void> {
    const entry: UnifiedEntry = {
      lastModified: Date.now(),
      value: data,
      kind: data?.kind ?? "unknown",
      size: estimateSize(data),
      createdAt: lruCache.get(key)?.createdAt ?? Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: lruCache.get(key)?.accessCount ?? 0,
      tags: ctx?.tags ?? [],
      revalidate: typeof data?.revalidate === "number" ? data.revalidate : null,
    };
    
    // 写入 LRU
    lruCache.set(key, entry);
    
    // 写入 KV（fire-and-forget，带 TTL）
    getKVClient()?.put(`cache:${key}`, entry, { expirationTtl: KV_TTL_SECONDS }).catch(err => {
      console.error(`[cache] KV put failed for ${key}:`, err.message);
    });
  }
  
  async revalidateTag(tags: string | string[]): Promise<void> {
    const tagList = Array.isArray(tags) ? tags : [tags];
    const now = Date.now();
    const kv = getKVClient();
    
    // 1. 更新内存 tag 时间戳
    for (const tag of tagList) {
      tagRevalidatedAt.set(tag, now);
    }
    
    // 2. 清除 LRU 中匹配的 entry
    for (const [key, entry] of lruCache.entries()) {
      if (entry.tags.some(t => tagList.includes(t))) {
        lruCache.delete(key);
      }
    }
    
    // 3. 每个 tag 单独写入 KV（带 TTL）
    if (kv) {
      await Promise.all(
        tagList.map(tag => kv.put(`tag:${tag}`, now, { expirationTtl: KV_TTL_SECONDS }))
      );
    }
  }
}
```

### Phase 3: 监控面板适配

更新 `getCacheStats()` 反映双层架构：

```typescript
export function getCacheStats(): CacheStats {
  const entries: CacheEntryMeta[] = [];
  // ... 遍历 lruCache 收集统计
  
  return {
    totalEntries: entries.length,
    totalSizeBytes,
    entriesByKind,
    sizeByKind,
    entries: entries.slice(0, 100),
    oldestEntry,
    newestEntry,
    // 新增：KV 后端状态
    kvBackend: {
      enabled: !!getKVClient(),
      // LRU 只是热数据子集，实际缓存量更大
      note: "Stats reflect LRU hot cache only; KV cold storage not included",
    },
  };
}
```

## 性能考量

### KV 延迟

| 场景 | 延迟 |
|------|------|
| 同区域读取 | ~10ms |
| 跨区域读取 | ~50ms |
| 写入（最终一致） | ~10ms |

### 优化策略

1. **热数据内存缓存**：高频访问的页面保留在 LRU
2. **异步写入**：KV put 不阻塞响应
3. **Lazy invalidation**：tag 失效时不立即清理 KV，get 时检查再删

### 监控指标

- `lru_cache_hit_rate`: LRU 命中率
- `kv_cache_hit_rate`: KV 命中率（LRU miss 后）
- `kv_latency_p50/p99`: KV 读写延迟

## 原子化提交计划

1. `feat(lib): add KV client for Cloudflare REST API`
2. `feat(cache): add LRU layer with capacity limit`
3. `feat(cache): integrate KV as cold storage backend`
4. `feat(cache): persist tag revalidation timestamps to KV`
5. `test(cache): add KV cache integration tests`
6. `feat(api): update /api/system/memory for dual-layer stats`

## 回滚方案

如果 KV 出现问题：
1. 环境变量不配置 `KV_NAMESPACE_ID` → 自动回退到纯 LRU 模式
2. Cache handler 检测到 KV 不可用时自动降级
3. 监控面板显示 `kvBackend.enabled: false`

## 测试计划

### L1: 单元测试
- KV client mock 测试
- LRU 淘汰策略测试
- Cache handler get/set 测试
- Tag revalidation 跨 LRU+KV 测试

### L2: API E2E
- 使用 `lizhengblog-test` namespace
- 验证页面缓存写入 KV
- 验证重启后缓存恢复
- 验证 tag revalidation 生效

### 性能基准
- 对比迁移前后的 TTFB
- 监控 LRU 命中率
- 验证内存占用下降

---

## 超出范围

### Rate Limiter 迁移

当前限流器 (`src/lib/rate-limit.ts`) 是内存 sliding-window 实现，与缓存迁移是**独立的优化方向**。

**不在本计划内的原因**：
1. 限流器 API 返回 `{ allowed, remaining, resetMs }`，用于生成 `Retry-After` 响应头
2. 迁移到 KV 需要重新设计数据结构（简单计数器无法提供 resetMs）
3. KV 是最终一致性，精确限流需要 Durable Objects
4. 这是行为变更，不是存储后端替换

如需迁移限流器，应作为独立 RFC 评估。
