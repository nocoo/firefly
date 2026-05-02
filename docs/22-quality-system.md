# 质量体系：六维测试金字塔

本文档描述 Firefly 项目的完整质量保障体系（L1 + L2 + L3 + G1 + G2 + Worker）。

> 更新日期: 2026-05-03

---

## 一、体系概览

### 测试金字塔

```
                        ┌─────────────┐
                        │  L3 (139)   │  ← CI (Playwright)
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
| **G1** | 静态分析 | 类型检查 (`tsc --noEmit`) + ESLint strict | pre-commit | Hard |
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
| L3 测试数量 | 139 | - |
| Worker 测试数量 | 96 | - |
| **总测试数量** | **1,969** | - |

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

CI 使用独立的测试资源：

| 资源 | 生产 | 测试 |
|------|------|------|
| D1 Database | `CF_D1_DATABASE_ID` | `CF_D1_TEST_DATABASE_ID` (via test Worker) |
| R2 Bucket | `R2_BUCKET_NAME` | `R2_TEST_BUCKET_NAME` |
| Worker | `firefly.worker.hexly.ai` | 同上 (连接 test D1) |

### GitHub Secrets

| Secret | 用途 |
|--------|------|
| `WORKER_URL` | 测试 Worker URL |
| `WORKER_SECRET` | Worker 认证密钥 |
| `CF_ACCOUNT_ID` | Cloudflare 账户 ID |
| `R2_ACCESS_KEY_ID` | R2 访问密钥 ID |
| `R2_SECRET_ACCESS_KEY` | R2 访问密钥 |
| `R2_TEST_BUCKET_NAME` | 测试 R2 bucket |
| `R2_PUBLIC_URL` | R2 公开 URL |
| `R2_KEY_PREFIX` | R2 key 前缀 |
| `AUTH_SECRET` | NextAuth 密钥 |
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

`.env.test` 覆盖以下变量用于 E2E 测试：

```bash
WORKER_URL=http://localhost:8787    # 本地 Worker (或远程 test Worker)
WORKER_SECRET=test-secret
E2E_SKIP_AUTH=true                  # 跳过认证
CI=true                             # 启用 E2E 模式
R2_BUCKET_NAME=lizhengblog-test     # 测试 R2 bucket
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
| `bun run typecheck` | G1 | TypeScript 类型检查 |
| `bun run lint` | G1 | ESLint strict |
| `cd worker && bun test` | Worker | Worker 单元测试 |

---

## 五、Git Hooks

### pre-commit

```bash
# 并行执行
G1: tsc --noEmit
G1: lint-staged (ESLint)
L1: vitest run
```

### pre-push

```bash
# 并行执行
L1: vitest run --coverage (90% 门槛)
G1: eslint
L2: API E2E
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
