# Autoresearch: 优化 UT 执行时间

## 目标
在保持覆盖率 95%+ 的前提下，优化单元测试执行时间。

## 基准测试方法
运行 `bun run test:coverage` 测量：
- Duration (总时间)
- tests 时间（实际测试执行时间）
- 覆盖率指标

## 约束
- 覆盖率保持在 95%+ (lines, branches, functions, statements)
- 不删除有意义的测试
- 不过拟合基准测试

## 主要指标
- `test_duration_s`: 测试总时间（秒）

## 次要指标
- `tests_count`: 测试用例数量
- `coverage_lines`: 行覆盖率

## 已完成优化

### 1. DNS 超时测试优化 ✅
**问题**: `unfurl.test.ts` 中的 "throws on DNS timeout" 测试等待真实的 5 秒 DNS 超时。
**解决**: 改用 mock rejection 模拟超时行为，无需等待真实超时。
**效果**: 6.10s → 1.13s (-81.5%)

## 结果总结
| 指标 | 基线 | 优化后 | 改善 |
|------|------|--------|------|
| Duration | 6.10s | 1.09s | -82.1% |
| Tests | 1261 | 1261 | 0% |
| Coverage (lines) | 99.19% | 99.14% | -0.05% |
| Coverage (branches) | 98.63% | 98.63% | 0% |
| Coverage (functions) | 97.56% | 97.28% | -0.28% |
| Coverage (statements) | 99.42% | 99.42% | 0% |

所有覆盖率指标仍然在 95%+ 以上。
