# Autoresearch Ideas: UT 优化

## 已完成 ✅

### DNS 超时测试优化
- 原问题: unfurl.test.ts 等待真实 5s DNS 超时
- 解决: 用 mock rejection 模拟超时
- 效果: 6.10s → 1.13s

### GitHub gist URL bug 修复
- 原问题: fetchGitHubReadmeImage 对 gist URL 触发真实 fetch 等待超时
- 解决: 添加 GITHUB_SPECIAL_PATHS 排除 gist、settings 等非 repo 路径
- 效果: bug 修复 + 消除测试超时

## 评估后不执行

### 参数化 SSRF 测试
- 可以用 `it.each` 合并多个私有网络测试
- 但会降低可读性和隔离性
- 当前测试时间已经很快（~1s），不值得

### Vitest 缓存
- 尝试启用 cache 配置
- 效果不明显（transform/import 时间主导）

## 结论

主要优化已完成。6.10s → 1.11s (-81.8%)

剩余时间（~1s）主要是:
- transform: ~3.3s (TypeScript 编译)
- import: ~5.3s (模块加载)
- tests: ~0.6s (实际测试执行)

这些是 vitest 的固有开销，进一步优化空间有限。所有测试执行时间都在 0-8ms 范围内。

## 潜在优化方向（低优先级）

### Vitest 并行执行配置
- 可能可以通过调整 `poolOptions.threads` 优化
- 但需要在多核机器上测试效果
- 当前测试数量不多，可能看不到明显效果

### 减少测试文件数量
- 合并小测试文件可能减少 import 开销
- 但会降低代码组织性
- 不推荐仅为性能牺牲可维护性
