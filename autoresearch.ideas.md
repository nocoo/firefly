# Autoresearch Ideas: UT 优化

## 已完成 ✅

### DNS 超时测试优化
- 原问题: unfurl.test.ts 等待真实 5s DNS 超时
- 解决: 用 mock rejection 模拟超时
- 效果: 6.10s → 1.09s (-82%)

## 评估后不执行

### 参数化 SSRF 测试
- 可以用 `it.each` 合并多个私有网络测试
- 但会降低可读性和隔离性
- 当前测试时间已经很快（~1s），不值得

### Vitest 缓存
- 尝试启用 cache 配置
- 效果不明显（transform/import 时间主导）

## 结论

主要优化已完成。剩余时间（~1s）主要是:
- transform: ~2.5s (TypeScript 编译)
- import: ~4s (模块加载)
- tests: ~1.2s (实际测试)

这些是 vitest 的固有开销，进一步优化空间有限。
