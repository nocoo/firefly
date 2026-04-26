# Autoresearch Ideas: L1+L2+L3 优化

## UT (test:coverage) 已落地（2026-04）

基线 1.87s → 0.77-0.85s (-57%)

### Round 1–2
- `pool=threads` + 顶层 `isolate=false`：Vitest 4 复用 worker 模块图
- `coverage.reporter=['text-summary']`：跳过 per-file 表格
- 移除 `globals: true`（所有测试都显式 import）

### Round 3 额外加速
- **折叠 Vitest projects 为单一顶层 config**：避免两个 project 各自 boot 一个 worker pool（0.89s→0.80s）
- **`maxWorkers: 12`**（8 cores hyperthread 到 16）把全局 70 个文件的 import 带宽丢到更多线程（0.80s→0.77s）
- **`maxConcurrency: 20`**：让 `describe.concurrent` 嵌套 it 能更多并发
- coverage 同时覆盖 `src/**` 与 `worker/src/**`，>95%

## UT 探索过的死路
- `pool: vmThreads / vmForks / forks` 都慢于 threads
- `maxWorkers=2/4/6/8/10/14/16` 都不如 12；减少 worker + isolate=false 造成 mock 跨文件污染导致测试失败
- `fileParallelism: false` 1.5s+
- `coverage.skipFull/clean=false/excludeAfterRemap/processingConcurrency/allowExternal` 都在噪声内
- `deps.optimizer.ssr.enabled` / `optimizeDeps.include` 无收益
- `server.deps.inline=true` 1.3s+（必须转换所有 node_modules）
- `server.preTransformRequests=false` 噪声
- `bunx --bun vitest` Bun runtime 跑 vitest segfault
- `unplugin-swc` SWC 转换器 — 与 esbuild 持平或略慢
- `@vitest/coverage-istanbul` — 1.5s+ 远慢于 v8
- `sequence.concurrent: true` — 造成大量 mock 污染导致测试失败
- `esbuild.target: esnext` / `legalComments: none` 噪声
- `execArgv: ['--no-warnings']` 噪声
- 别名 `next/server` 到小 stub：只能微幅提升，但会掊盖生产行为差异，风险大于收益
- 显示 `cacheDir` — 与默认一致无变化

## 危险陷阱 ⚠️
- **`maxWorkers` / `fileParallelism` 不能放在 project 配置里**：vitest 静默运行 0 个测试，需在 `test:` 顶层
- **顶层 `maxWorkers` 减少 + `isolate: false`**：jest mock 会跨文件污染。sweet spot 是默认或略高 （10-12）
- **`sequence.concurrent: true`**：同一文件内的 mock 会被并发 it 破坏

## UT 仍可尝试（低优先级）
- 拆分 `src/data/entities/post.test.ts`（1725 行）、`src/services/unfurl.test.ts`（833 行）提高负载平衡——但 isolate=false 下拆分可能增加跨线程 import 重复费用
- 迁移到 bun:test（需重写 vi.fn / vi.mock 为 bun 等价品，大工作量）
- 预编译所有 src 为单一 bundle，让 vitest 跳过逐文件 transform（复杂）



### 构建复用
- **Build once, two servers**: `startNextServer` 调用两次时只 build 一次
- **Skip rebuild when fresh**: 检查 `.next/BUILD_ID` mtime vs 源文件，无变更则复用
- **Turbopack for E2E build**: 13s → 8s (production build script 不变)

### L2 并行
- **Vitest projects**: 拆分 `e2e-parallel` (默认) 与 `e2e-serial` (backup/settings/auth/unfurl-enhance)
- **describe.concurrent**: 在所有无共享状态的 L2 文件应用（mcp/posts/admin-posts/analytics/categories/tags/posts-excerpt/md-export）

### L3 并行
- **Playwright fullyParallel + workers=10**: 默认 8 → 10
- **retries=1**: 缓解远程 D1 worker 偶发 500 / L2-L3 跨 suite 数据竞争

### 杂项
- **waitForServer poll**: 500ms → 100ms

## 评估后不执行（已尝试）

### L2+L3 并行执行
- 共享远程 Cloudflare D1 worker
- 双 Next.js + L2 vitest + L3 playwright 同时打到 worker → 大量 500/rate limit
- 即便分离两个端口，DB 数据竞争仍导致 preview/admin-list 测试失败
- **结论**：必须串行

### waitUntil 改 load/domcontentloaded
- 没有显著加速（35→35s）
- domcontentloaded 引入 click-after-navigate 的 race
- **结论**：networkidle 是合理选择

### maxWorkers=12（vitest L2）
- 长尾 mcp/media/posts 各 ~15s 已饱和
- 无收益

## 潜在但风险高

### 削减 L2 测试中等待 dilatation
- `Date.now()` 加随机后缀避免并发碰撞（admin-ai-agents 已用前缀+suffix=Date.now()，concurrent 时同毫秒可能撞）
- 改为 `crypto.randomUUID()` 后缀更稳

### media.test.ts 全 concurrent
- associate test 依赖 GET /api/media？post_id 看到 orphan
- 多 describe 并发上传/删除时全局列表会闪烁
- 当前保留 serial（13s 单文件）

### 切换到本地测试 worker（lizhengme-db-test 本地副本）
- 当前 `.env.test` 设 `WORKER_URL=http://localhost:8787` 但被 `.env` 的远程 URL 覆盖
- 若改为本地 wrangler dev + 本地 D1，可放心做 L2+L3 并行（节省 ~25s）
- 风险：需要本地 D1 数据 seed，实现成本大

### 减少 mcp.test.ts 长尾
- 30 tests 集中在 1 文件、~15s
- 拆分 OAuth Authorize/Callback 到独立文件可与 mcp 主流程并行
- 收益：可能 -3~5s on L2 only path

## 当前结果
| 阶段 | 基线 | 优化后 |
|------|------|--------|
| L1 | 1.03s | 1.07s |
| L2+L3 | 107.9s | 56s (rebuild) / 30s (cached build) |
| 总计 | 108.9s | 57-65s |
| 改善 | - | -40~47% |
