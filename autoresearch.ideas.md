# Autoresearch Ideas: L1+L2+L3 优化

## 已完成 ✅

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
