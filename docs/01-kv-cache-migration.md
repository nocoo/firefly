# KV Cache Migration Plan

将 Next.js 内存缓存迁移到 Cloudflare KV，降低运行时内存占用，同时保持性能。

## 背景

当前 firefly 使用自定义 `cache-handler.ts` 将 Next.js ISR/fetch 缓存存储在进程内存中。长时间运行后：

- 内存占用持续增长（页面缓存累积）
- 重启后缓存全部丢失，需要重新预热
- 无法跨实例共享缓存

## 目标

1. **降低内存占用**：页面缓存存储到 Cloudflare KV
2. **保持性能**：KV 读取延迟 ~10-50ms，对 ISR 可接受
3. **缓存持久化**：重启不丢失热门页面缓存
4. **最终关闭 Next.js 内置缓存**：完全依赖 KV

## KV Namespace

| 环境 | Namespace | ID |
|------|-----------|-----|
| Production | `lizhengblog` | `4246634d54b243d2a9b29c9317a2eb68` |
| Test (E2E) | `lizhengblog-test` | `dca9e942f1ff4739bf5c8d2f28ac2ea0` |

环境变量：
```bash
# .env.local / Railway
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
│  │       cache-handler.ts (KV adapter)     │    │
│  │  - 热数据：LRU in-memory (小容量)       │    │
│  │  - 冷数据：Cloudflare KV                │    │
│  └─────────────────────────────────────────┘    │
│                        │                        │
│                        ▼                        │
│              Cloudflare KV (边缘)               │
│              lizhengblog namespace              │
└─────────────────────────────────────────────────┘
```

## 实施计划

### Phase 1: KV Client 封装

**文件**: `src/lib/kv-client.ts`

```typescript
// KV client using Cloudflare REST API
// Railway 无法直接绑定 KV，通过 REST API 访问

export interface KVClient {
  get<T>(key: string): Promise<T | null>;
  put(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
}

export function createKVClient(accountId: string, namespaceId: string, apiToken: string): KVClient;
```

**环境变量**：
```bash
CF_ACCOUNT_ID=xxx          # 已有
CF_API_TOKEN=xxx           # 需新增，KV 读写权限
KV_NAMESPACE_ID=xxx        # 新增
```

### Phase 2: Cache Handler 改造

**文件**: `src/lib/cache-handler.ts`

改造点：
1. `get()` 先查内存 LRU，miss 则查 KV
2. `set()` 写入 KV，同时更新内存 LRU
3. `revalidateTag()` 写入 KV tag 时间戳
4. 内存 LRU 容量限制（如 100 条或 50MB）

```typescript
// 新增依赖
import { createKVClient } from "./kv-client";

// LRU 配置
const LRU_MAX_ENTRIES = 100;
const LRU_MAX_SIZE_MB = 50;

// 双层缓存
const memoryCache = new LRUCache<string, UnifiedEntry>({ max: LRU_MAX_ENTRIES });
const kvClient = createKVClient(...);

export default class CacheHandler {
  async get(key: string) {
    // 1. 查内存
    const mem = memoryCache.get(key);
    if (mem) return mem;
    
    // 2. 查 KV
    const kv = await kvClient.get(key);
    if (kv) {
      memoryCache.set(key, kv); // 回填内存
      return kv;
    }
    return null;
  }
  
  async set(key: string, value: any, options: CacheOptions) {
    // 写入 KV（持久化）
    await kvClient.put(key, value, options.revalidate);
    // 写入内存（热数据）
    memoryCache.set(key, value);
  }
}
```

### Phase 3: Rate Limiter 迁移（可选）

当前 `rate-limit.ts` 使用 in-memory Map，可考虑迁移到 KV：

```typescript
// rate-limit-kv.ts
export async function rateLimitKV(ip: string, limit: number, windowSec: number) {
  const key = `rate:${ip}`;
  const data = await kvClient.get<{ count: number; ts: number }>(key);
  
  const now = Date.now();
  if (data && now - data.ts < windowSec * 1000) {
    if (data.count >= limit) return { allowed: false };
    await kvClient.put(key, { count: data.count + 1, ts: data.ts }, windowSec);
  } else {
    await kvClient.put(key, { count: 1, ts: now }, windowSec);
  }
  return { allowed: true };
}
```

**注意**: KV 是最终一致性，限流不够精确。如需精确限流，考虑 Durable Objects。

### Phase 4: 关闭 Next.js 内置缓存

验证 KV 缓存稳定后，在 `next.config.ts` 中禁用内置缓存：

```typescript
// next.config.ts
export default {
  experimental: {
    // 使用自定义 cache handler，禁用内置缓存
    incrementalCacheHandlerPath: require.resolve("./src/lib/cache-handler"),
  },
};
```

## 性能考量

### KV 延迟

| 场景 | 延迟 |
|------|------|
| 同区域读取 | ~10ms |
| 跨区域读取 | ~50ms |
| 写入（最终一致） | ~10ms |

### 优化策略

1. **热数据内存缓存**：高频访问的页面保留在内存 LRU
2. **批量读取**：Next.js 预渲染时可能并发请求多个缓存
3. **TTL 策略**：短 TTL 页面不写 KV（如实时数据）

### 监控指标

- `kv_cache_hit_rate`: KV 命中率
- `memory_cache_hit_rate`: 内存 LRU 命中率
- `kv_latency_p50/p99`: KV 读写延迟

## 原子化提交计划

1. `feat(lib): add KV client for Cloudflare REST API`
2. `feat(cache): add LRU layer to cache handler`
3. `feat(cache): integrate KV as cold storage`
4. `test(cache): add KV cache integration tests`
5. `feat(rate-limit): migrate to KV (optional)`
6. `chore(config): disable Next.js built-in cache`

## 回滚方案

如果 KV 出现问题：
1. 环境变量 `KV_ENABLED=false` 回退到纯内存模式
2. Cache handler 检测到 KV 不可用时自动降级

## 测试计划

### L1: 单元测试
- KV client mock 测试
- LRU 淘汰策略测试
- Cache handler get/set 测试

### L2: API E2E
- 使用 `lizhengblog-test` namespace
- 验证页面缓存写入/读取
- 验证 tag revalidation

### 性能基准
- 对比迁移前后的 TTFB
- 监控内存占用变化
