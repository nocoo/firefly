# 质量体系：六维测试金字塔

本文档描述 Firefly 项目的完整质量保障体系（L1 + L2 + L3 + G1 + G2 + Worker）。

> 更新日期: 2026-05-03

---

## 一、体系概览

### 测试金字塔

```
                        ┌─────────────┐
                        │  L3 (158)   │  ← CI (Playwright)
                        │   Browser   │
                    ┌───┴─────────────┴───┐
                    │      L2 (330)       │  ← pre-push + CI (API E2E)
                    │   真实 HTTP 请求     │
                ┌───┴─────────────────────┴───┐
                │         L1 (1,404)          │  ← pre-commit
                │  Unit + Integration + Cov   │
            ┌───┴─────────────────────────────┴───┐
            │          Worker (96)                │  ← CI
            │      Edge Worker 单元测试            │
        ┌───┴─────────────────────────────────────┴───┐
        │              G1 + G2 (静态分析 + 安全)         │  ← pre-commit + pre-push
        │   TypeScript + ESLint + gitleaks + osv-scanner │
        └─────────────────────────────────────────────────┘
```

### 层级定义

| 层级 | 名称 | 验证对象 | 执行时机 | 门控类型 |
|------|------|----------|----------|----------|
| **L1** | 单元 + 集成测试 | 纯函数、数据层、服务层、组件 | pre-commit | Hard |
| **L2** | API E2E | 真实 HTTP 请求到运行中的 Next.js 服务器 | pre-push + CI | Hard |
| **L3** | 系统 E2E | 真实用户端到端流程（Playwright 浏览器自动化） | CI | Hard |
| **G1** | 静态分析 | 类型检查 (`tsc --noEmit`，TypeScript 7.0.2) + Biome 2.5 + custom gates (`dynamic-delete` / `@ts-expect-error`) | pre-commit | Hard |
| **G2** | 安全检查 | Secrets 泄露 (gitleaks) + 依赖漏洞 (osv-scanner) | pre-push + CI | Hard |
| **Worker** | Edge Worker | Cloudflare Worker 边缘逻辑 | CI | Hard |

### 当前指标

| 指标 | 当前值 | 目标 |
|------|--------|------|
| L1 测试数量 | 1,404 | - |
| L1 语句覆盖率 | 99% | ≥ 90% |
| L1 分支覆盖率 | 97.69% | ≥ 80% |
| L1 函数覆盖率 | 97.6% | ≥ 85% |
| L1 行覆盖率 | 99.34% | ≥ 90% |
| L2 API 路由覆盖 | 49/49 (100%) | 100% |
| L2 测试数量 | 330 | - |
| L3 页面覆盖 | 27/27 (100%) | 100% |
| L3 测试数量 | 158 | - |
| Worker 测试数量 | 96 | - |
| **总测试数量** | **1,988** | - |

---

## 二、CI/CD 配置

### GitHub Actions 工作流

四个 job 并行执行：

```yaml
jobs:
  quality:      # L1 + G1 + G2 (from base-ci)
  api-e2e:      # L2 API E2E
  browser-e2e:  # L3 Playwright
  worker-tests: # Worker 单元测试
```

### 环境隔离

E2E 使用完全本地的测试基础设施，零远程 Cloudflare 资源依赖：

| 资源 | 生产 | E2E 测试 |
|------|------|----------|
| D1 Database | 远程 `lizhengme-db` via Worker | 本地 Miniflare SQLite (`.wrangler/e2e-d1`) |
| R2 Storage | 远程 `lizhengblog` via S3 SDK | 本地文件系统 (`.wrangler/e2e-r2`) |
| Worker | `firefly.worker.hexly.ai` | 本地 `wrangler dev --local` |

### GitHub Secrets

| Secret | 用途 |
|--------|------|
| `AUTH_SECRET` | NextAuth 密钥 (Next.js 启动需要) |
| `AUTH_ALLOWED_EMAILS` | 允许的 E2E 测试邮箱 |

---

## 三、本地开发

### 环境变量

复制 `.env.example` 到 `.env` 并配置：

```bash
cp .env.example .env
```

必需的环境变量见 `.env.example` 和 README.md。

### E2E 测试环境

E2E runner (`scripts/run-e2e.ts`) 自动注入所有必要的环境变量：

```bash
WORKER_URL=http://localhost:8787    # 本地 Worker (wrangler dev --local)
WORKER_SECRET=test-secret
E2E_SKIP_AUTH=true                  # 跳过认证
CI=true                             # 启用 E2E 模式
R2_BUCKET_NAME=local-e2e            # 本地 R2 adapter
R2_PUBLIC_URL=http://localhost:17028/__e2e-r2
E2E_R2_LOCAL_DIR=.wrangler/e2e-r2   # 文件系统 R2 替身
```

---

## 四、测试命令速查

| 命令 | 层级 | 说明 |
|------|------|------|
| `bun run test` | L1 | 单元测试 |
| `bun run test:watch` | L1 | Watch 模式 |
| `bun run test:coverage` | L1 | 覆盖率报告 (90% 门槛) |
| `bun run test:e2e:api` | L2 | API E2E (启动 server，真 HTTP) |
| `bun run test:e2e:browser` | L3 | Playwright E2E |
| `bun run typecheck` | G1 | TypeScript 7 类型检查（root + worker） |
| `bun run lint` | G1 | typecheck + Biome + custom gates |
| `bun run gate:dynamic-delete` | G1 | 禁止 `delete obj[computed]` |
| `bun run gate:ts-expect-error` | G1 | `@ts-expect-error` 必须带 ≥10 字说明 |
| `cd worker && bun test` | Worker | Worker 单元测试 |

---

## 五、Git Hooks

### pre-commit

```bash
# 并行执行
G1a: tsc --noEmit (root + worker)
G1b: lint-staged (Biome on staged files)
L1: vitest run
# 串行
G1c: gate:dynamic-delete + gate:ts-expect-error（扫 INDEX 快照）
```

### pre-push

```bash
L1: vitest run --coverage (≥95% 门槛)
G1: bun run lint（typecheck + Biome + gates）
G2: gitleaks + osv-scanner
```

---

## 六、测试目录结构

```
src/
├── **/*.test.ts          # L1: 单元测试 (与源文件同目录)

e2e/
├── api/                  # L2: API E2E 测试
│   ├── posts.test.ts
│   ├── tags.test.ts
│   ├── categories.test.ts
│   ├── mcp.test.ts
│   └── ...
├── browser/              # L3: Playwright E2E 测试
│   ├── admin-posts.spec.ts
│   ├── content-images.spec.ts
│   └── ...
├── vitest.config.ts      # L2 vitest 配置
└── playwright.config.ts  # L3 playwright 配置

worker/
└── test/                 # Worker 单元测试
    ├── fts.test.ts
    └── index.test.ts
```

---

## 七、端口分配

| 端口 | 用途 |
|------|------|
| 7028 | 开发服务器 (`bun run dev`) |
| 17028 | L2 API E2E 测试 |
| 27028 | L3 Playwright E2E 测试 |
| 8787 | 本地 Worker (wrangler dev) |
