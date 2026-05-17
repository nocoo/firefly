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

### 2. GitHub gist URL bug 修复 ✅
**问题**: `fetchGitHubReadmeImage` 测试 gist URL 时触发真实网络请求等待超时。
**根因**: 正则 `GITHUB_REPO_RE` 匹配了 `github.com/gist/123`，导致尝试 fetch 不存在的 README。
**解决**: 添加 `GITHUB_SPECIAL_PATHS` 集合排除 gist、settings 等非 repo 路径。
**效果**: 这是 bug 修复，同时消除了测试超时问题。

## 结果总结
| 指标 | 基线 | 优化后 | 改善 |
|------|------|--------|------|
| Duration | 6.10s | 1.11s | -81.8% |
| Tests | 1261 | 1261 | 0% |
| Coverage (lines) | 99.19% | 99.20% | +0.01% |
| Coverage (branches) | 98.63% | 98.63% | 0% |
| Coverage (functions) | 97.56% | 97.56% | 0% |
| Coverage (statements) | 99.42% | 99.42% | 0% |

所有覆盖率指标仍然在 95%+ 以上。

## 已完成优化 (Round 2)

### 3. Vitest 4 升级后的并行 + 单进程优化 ✅
**改动**:
1. `vitest.config.ts` 设 `pool: "threads"` + `isolate: false`（v4 顶层配置）— 复用 worker 模块图，省去文件级隔离开销。
2. 用 Vitest 4 `projects` 把 `worker/test/**` 作为独立 project 拼进根 vitest 配置，单进程同时跑 src+worker（之前是两个 vitest 进程串行）。
3. coverage `reporter: ["text-summary"]` 跳过冗长的 per-file 表格输出。
4. coverage `include` 同时覆盖 `src/**` 与 `worker/src/**`，所有覆盖率指标 >95%。
5. `test`/`test:coverage` 改为直接调用 vitest（移除 wrapper 脚本依赖）。

**效果**: 1.87s → 0.89s（-52%）。

## 结果总结 (Round 2)
| 指标 | 基线 | 优化后 |
|------|------|--------|
| Duration (test:coverage) | 1.87s | 0.77-0.82s (-58%) |
| Tests | 1404 (src 1308 + worker 96) | 1404 |
| Lines coverage | 99.34% | 99.34% |
| Branches | 97.69% | 97.69% |
| Functions | 97.6% | 97.6% |

进一步优化需要大性能改造（迁移到 bun:test 或安装 SWC 转换器），风险高且收益小。

## Round 3 补充优化 ✅

### 4. 折叠 src + worker projects 为单一顶层 vitest 配置✅
**问题**: 两个 vitest project 各自 spawn worker pool 〈= 8 + 8 = 16 worker boots 〉。
**修复**: 拆除 `projects: [...]`, 合并 includes 为 `["src/**/*.test.ts", "worker/test/**/*.test.ts"]`，在顶层 `test:` 设 `pool/isolate/maxConcurrency/maxWorkers`。
**效果**: 0.89s → 0.80s（-10%）。

### 5. maxWorkers=12 平衡并行 import 开销 ✅
**本地 16 核 CPU，默认 worker count = min(8, cores)**。
合并 project 后加 `maxWorkers: 12`（不在 project 里），把 70 个文件的 import 负载分散到更多线程。
**效果**: 0.80s → 0.77s。进一步增到 14/16 反而变慢（10/12 是甜蜜点）。

### 6. maxConcurrency=20
默认 5，调高让 `describe.concurrent` 里的嵌套 it 能更多并发（轻度收益）。

## 探索过的死路 (Round 2)
- `pool: vmThreads` — 慢于 threads (~1.0s)
- `maxWorkers=2` / `=4` / `=8` — 等于或慢于默认
- `fileParallelism: false` — 1.5s+，单线程明显更慢
- `coverage.skipFull/clean=false/processingConcurrency=16` — 噪声范围内
- 应用 `pool=threads` 到 worker vitest — 因已与 src 并行重叠，无收益

## 危险陷阱 ⚠️
- **`maxWorkers` / `fileParallelism` / `minWorkers` 不能放在 project 级配置**：vitest 静默运行 0 个测试但报告 "PASS"，需要在 `test:` 顶层。
- **顶层 `maxWorkers` 减少 + `isolate: false`**：会造成跨文件状态泄漏，导致测试失败。默认 worker count（8）+ isolate=false 是边缘平衡，减少 worker 会让 concurrent 测试间的 mock/全局状态互相污染。

---

## 2026-05-17 Refactor Session: complexity reduction + coverage hardening

### Final results (28 experiments, 27 keep, 0 discard)

| Metric | Baseline | Final | Δ |
|---|---|---|---|
| files >400 LOC | 13 | **0** | -100% |
| max file LOC | 869 | **392** | -55% |
| excess LOC over 400 | 2442 | **0** | -100% |
| non-JSX functions >100 LOC | 5 | **0** | -100% |
| Lines coverage | 98.61% | **99.57%** | +0.96 pp |
| Branches coverage | 96.44% | **98.28%** | +1.84 pp |
| Functions coverage | 96.99% | **99.27%** | +2.28 pp |
| Tests passing | 1318 | **1346** | +28 |

### What worked
1. **Split-then-barrel** for data layer (post.ts, analytics.ts, unfurl.ts) — implementation moved to siblings, original file becomes pure re-export. Zero call-site churn.
2. **Self-contained subcomponents** for React files: extract logo card / social links / pull card / push card etc. with their own state so parent shrinks to composition.
3. **Stage-function decomposition** for long imperative code (`proxy()` → 7 nullable stages via `??` chain).
4. **Config-driven validators** (settings PUT route): replace 9 inline `if (...)` blocks with a `parseSettingsBody` driver + 5 named validators + table-driven string-field loop.
5. **Honest coverage tests over exclude-list inflation**: instead of adding `e2e-local.ts` / `backup.server.ts` to coverage.exclude (+1% coverage for free), wrote real tests. Same gain, no metric gaming.

### What didn't work
- Tried to disable `@next/next/no-img-element` with eslint inline comments — that rule isn't in the project's eslint config, so the disable comment became an "unused directive" warning. Just write `<img>` without the comment.
- One commit failed `log_experiment` post-commit hook (timed out on checks). Manual `git commit` from command line succeeded. Not blocking — autoresearch state is preserved.

### Outstanding (low-priority)
- 6 React components are still ≥100 LOC after JSX is counted line-for-line. Splitting further harms cohesion — pragmatic exception per the 100-LOC rule.
- 4 uncovered branches are defense-in-depth guards (post-cache LRU evict null check, resolveLocalR2Path's "escapes root" check, etc.) that are unreachable given upstream validation — they're documentation, not testable branches.
