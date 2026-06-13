# Firefly L3 → BDD 重构方案

> **Numbers in this doc are reproducible.** All test counts come from commands
> embedded inline; re-run them on `main` to verify. If a count drifts during
> the migration, update the doc in the same commit that changes the count.

## 1. 存量分析

### 1.1 测试规模

Reproducible baseline command (run from repo root):

```bash
grep -cE '^\s*test\(' e2e/browser/*.spec.ts | awk -F: '{s+=$2} END {print s}'
# => 178
```

| 指标 | 数值 |
|------|------|
| Spec 文件数 | 19 |
| 测试用例总数 | **178** |
| 管理后台域 (admin-*) | 7 spec, 83 tests |
| 认证域 (login-auth) | 1 spec, 13 tests |
| 博客前台域 (blog-archive/category/navigation/pagination/post-detail/search-preview/tag) | 7 spec, 52 tests |
| 内容/媒体域 (blog-taxonomy-pagination, content-images, rss-feed, seo-meta) | 4 spec, 30 tests |
| **合计** | **19 spec, 178 tests** |

域加总核对：83 + 13 + 52 + 30 = 178 ✅（域分组与 §1.2 表"域"列完全一致）

### 1.2 Spec 文件清单

Per-file counts (reproducible via
`grep -cE '^\s*test\(' e2e/browser/*.spec.ts`, sorted by domain):

| Spec 文件 | 测试数 | 域 | 覆盖范围 |
|-----------|--------|-----|---------|
| `admin-ai-agents` | 14 | Admin | AI Agent 列表、表单、新建 |
| `admin-backup-mcp` | 14 | Admin | 备份页面、MCP 令牌页面 |
| `admin-media` | 7 | Admin | 媒体库、灯箱 |
| `admin-post-edit` | 7 | Admin | 文章编辑页面 |
| `admin-posts` | 11 | Admin | 仪表盘、文章列表、新建文章、分析页 |
| `admin-settings` | 21 | Admin | 通用设置、AI 设置、站点身份、系统监控 |
| `admin-taxonomy` | 9 | Admin | 分类管理、标签管理 |
| `login-auth` | 13 | Auth | 登录页面、认证守卫 |
| `blog-archive` | 6 | Blog | 归档索引页 |
| `blog-category` | 7 | Blog | 分类页面 |
| `blog-navigation` | 7 | Blog | 首页导航、文章卡片 |
| `blog-pagination` | 7 | Blog | 首页分页 |
| `blog-post-detail` | 7 | Blog | 文章详情页 |
| `blog-search-preview` | 11 | Blog | 搜索页面、预览页面 |
| `blog-tag` | 7 | Blog | 标签页面 |
| `blog-taxonomy-pagination` | 12 | Content | 分类/标签/归档分页 |
| `content-images` | 9 | Content | 图片优化、灯箱、媒体库灯箱（详见 §1.2.1） |
| `rss-feed` | 4 | Content | RSS 订阅源 |
| `seo-meta` | 5 | Content | SEO meta 标签、JSON-LD 结构化数据 |
| **合计** | **178** | | |

#### 1.2.1 `content-images.spec.ts` 测试归属（pre-split attribution）

此 spec 跨域，必须在重构前显式归属，避免目标 spec 之间双计。归属决定见
§3 合并计划：

| 行号 | 测试名 | 主题 | 归属目标 spec |
|------|--------|------|--------------|
| L91 | `inline images have srcset attribute` | 前台图片渲染 | `seo-rss.spec.ts` |
| L100 | `inline image src points to /_next/image` | 前台图片渲染 | `seo-rss.spec.ts` |
| L109 | `click inline image opens lightbox` | 前台灯箱 | `blog-content.spec.ts` |
| L129 | `lightbox shows correct image` | 前台灯箱 | `blog-content.spec.ts` |
| L148 | `lightbox closes on X button, Escape, and backdrop` | 前台灯箱 | `blog-content.spec.ts` |
| L180 | `linked image click navigates without lightbox` | 前台链接图片 | `blog-content.spec.ts` |
| L209 | `RSS feed images do not use /_next/image proxy` | RSS 图片 | `seo-rss.spec.ts` |
| L230 | `media library page loads` | 后台媒体库 | `admin-media.spec.ts` |
| L235 | `clicking a media thumbnail opens lightbox with metadata` | 后台媒体库灯箱 | `admin-media.spec.ts` |

`content-images.spec.ts` 删除时，9 个测试按上表分别迁移到 3 个新 spec，**不双计**。

### 1.3 技术栈现状

| 维度 | 现状 |
|------|------|
| 框架 | Playwright (Chromium only) |
| 配置 | `e2e/playwright.config.ts` |
| 测试目录 | `e2e/browser/` |
| 端口 | 27028 (dev=7028, L2=17028, L3=27028) |
| 启动器 | `scripts/run-e2e.ts`（统一管理 Worker + Next.js + 迁移 + 测试） |
| 并行度 | 10 workers |
| CI 方式 | 自建 job（非 base-ci `enable-l3`） |
| 共享 fixtures | 无 |
| BDD 元素 | 零（无 Given/When/Then、无 .feature 文件、无 step definitions） |

### 1.4 测试风格分析

**命名模式**：全部使用命令式短句（`"login page loads"`, `"dashboard shows stats widgets"`），无行为描述。

**Locator 策略**：

| 定位方式 | 使用次数 | 占比 |
|----------|---------|------|
| `page.locator()` (CSS/组合) | 174 | 73% |
| `page.getByText()` | 45 | 19% |
| `data-testid` | 10 | 4% |
| `page.getByRole()` | 0 | 0% |

**断言模式**：

| 断言 | 使用次数 |
|------|---------|
| `toBeVisible()` | 148 |
| `toMatch()` | 26 |
| `toBe()` | 25 |
| `toHaveURL()` | 25 |
| `toHaveText()` | 2 |

**操作复杂度**：

| 操作 | 使用次数 | 说明 |
|------|---------|------|
| `page.goto()` | 187 | 每个 test 至少一次 |
| `.click()` | 35 | 导航和交互 |
| `.fill()` | 2 | 仅 admin-ai-agents 和 admin-posts |
| `keyboard` | 3 | 仅 admin-media 和 content-images（灯箱 Escape） |

**结论**：绝大多数测试是**只读验证**（加载页面 → 断言元素可见），极少数涉及写入操作。这使得 BDD 改写的风险很低。

### 1.5 已有痛点

1. **无共享 fixtures**：每个 spec 独立导入 `@playwright/test`，无公共辅助函数（仅 `blog-post-detail` 有局部 `gotoFirstPost` helper）
2. **describe 粒度不一致**：有的文件包含 2-4 个 describe（如 `admin-posts` 含 dashboard + posts list + editor + analytics），有的只有 1 个
3. **条件跳过逻辑重复**：多个 blog-* spec 都有 `if ((await xxx.count()) === 0) return;` 模式处理空数据库（应改为 `test.skip()`）
4. **CSS 定位器脆弱**：大量使用 `page.locator("aside, nav")`, `page.locator("h1, h2")` 等 fallback 选择器，说明 UI 结构不够稳定
5. **CI 非标准**：使用自建 job 而非 base-ci `enable-l3`，因为需要启动 Worker + Next.js 双进程

## 2. BDD 目标架构

### 2.1 方案选型

采用 **方案 B：L3 原地升级为 BDD**，与其他 personal 项目保持一致。

技术选型：**Playwright 原生 BDD**（Given/When/Then 命名约定 + 结构化步骤注释）。**不引入** 以下任何依赖：

- `playwright-bdd`
- `@cucumber/cucumber`
- `.feature` 文件 / Gherkin 语法
- 独立的 step definitions 目录

理由：
- Firefly 的 178 个测试都是 Playwright 原生写法，引入 .feature 文件的改写成本过高
- 其他已完成项目（dove/lyre/backy/gecko/neo/noheir/wooly/otter/pew-game）也使用的是 Playwright 原生 BDD 命名
- 保持依赖最小化

BDD 在本项目中的定义仅是：**test 名称用 Given/When/Then 句式 + 测试体内有 `// Given:` / `// When:` / `// Then:` 注释分段 + `describe` 用 `Feature:` 前缀**。

### 2.2 目录结构迁移

```
e2e/
├── browser/              # 当前（重构期与 bdd/ 并存，最终删除）
│   ├── admin-posts.spec.ts
│   ├── blog-navigation.spec.ts
│   └── ...
├── bdd/                  # 目标
│   ├── fixtures.ts       # 共享 fixtures（Page Object helpers）
│   ├── auth.spec.ts
│   ├── blog-reading.spec.ts
│   ├── blog-taxonomy.spec.ts
│   ├── blog-content.spec.ts
│   ├── admin-dashboard.spec.ts
│   ├── admin-posts.spec.ts
│   ├── admin-taxonomy.spec.ts
│   ├── admin-media.spec.ts
│   ├── admin-settings.spec.ts
│   ├── admin-ai-agents.spec.ts
│   ├── admin-backup-mcp.spec.ts
│   └── seo-rss.spec.ts
├── playwright.config.ts  # 重构期同时覆盖 browser/ 和 bdd/（见 §6.2）
└── vitest.config.ts      # L2（不变）
```

### 2.3 BDD 命名规范

**test 名称**：`"Given <前置条件>, When <操作>, Then <期望结果>"`

```typescript
// ❌ 当前风格
test("home page loads with blog posts", async ({ page }) => { ... });

// ✅ BDD 风格
test("Given the blog has published posts, When I visit the home page, Then I see post cards", async ({ page }) => {
  // Given: blog has published posts (seeded by E2E runner)
  // When: visit home page
  await page.goto("/");
  // Then: post cards are visible
  await expect(page.getByRole("article").first()).toBeVisible();
});
```

**describe 名称**：`"Feature: <功能域>"`

```typescript
// ❌ 当前风格
test.describe("Blog navigation", () => { ... });

// ✅ BDD 风格
test.describe("Feature: Blog Reading", () => { ... });
```

### 2.4 共享 Fixtures（边界约束）

`e2e/bdd/fixtures.ts` 的范围严格限定为以下三类**稳定**辅助：

1. **稳定导航**：跨多个 spec 共用、selector 不易变动的页面入口
   （如 `gotoFirstPost`、`gotoAdmin`）
2. **空数据处理**：把"数据库为空就跳过"包装为正确的 Playwright `test.skip()`
3. **Admin 鉴权绕过封装**：复用 `E2E_SKIP_AUTH` 环境约定的入口

**不放进 fixtures**：
- 任何 spec 内部一次性使用的 helper
- 任何与具体业务断言耦合的逻辑（如"检查文章卡片有标题"）
- 不稳定的 fallback selector（`h1, h2` / `aside, nav` 等）

`emptyDataGate` 必须返回结构化结果，调用方用 Playwright 原生 `test.skip()`
消费（不能用 `return` 提前退出，否则报告里看不到跳过原因）：

```typescript
// e2e/bdd/fixtures.ts
import { test as base, expect, type Page } from "@playwright/test";

/** Navigate to the first published post from home. Returns null if empty. */
export async function gotoFirstPost(page: Page): Promise<string | null> { ... }

/** Navigate to admin and ensure sidebar is visible. */
export async function gotoAdmin(page: Page, path = ""): Promise<void> { ... }

/** Inspect count; caller must consume via `test.skip(result.skip, result.reason)`. */
export function emptyDataGate(count: number, what: string): { skip: boolean; reason: string } {
  return count === 0
    ? { skip: true, reason: `Test DB has no ${what}; seed required.` }
    : { skip: false, reason: "" };
}

export { base as test, expect };
```

**调用示例**：

```typescript
test("Given posts exist, When …, Then …", async ({ page }) => {
  const count = await page.getByRole("article").count();
  const gate = emptyDataGate(count, "published posts");
  test.skip(gate.skip, gate.reason);
  // …
});
```

### 2.5 Locator 策略（迁移强制）

迁移过程中 selector 必须按以下优先级选择：

1. `page.getByRole("...", { name: "..." })` — 首选，可访问性 + 语义最佳
2. `page.getByLabel(...)` — 表单字段首选
3. `page.getByTestId(...)` — 需要 `data-testid` 锚点的情况
4. `page.getByText(...)` — 用户可见文本断言时可以接受
5. `page.locator("css")` — **仅作为兜底**，且必须在代码里加注释说明为何无法用前 4 种

**禁止迁移**：现有的 `page.locator("h1, h2")` / `page.locator("aside, nav")`
等结构 fallback selector。若 UI 缺少稳定锚点，先补 `data-testid` 或 ARIA
role 再迁移，**不要原样复制**。

## 3. Spec 合并计划

当前 19 个 spec 合并到 12 个 BDD spec。

> **来源数核对原则**：本表"原测试数"列必须与 §1.2 完全一致；`content-images`
> 的 9 个测试按 §1.2.1 拆分归属，不允许在两行同时累加 9。

| 目标 BDD Spec | 合并来源 (旧 spec → 取用测试数) | 原测试数 | 预估 BDD 测试数 |
|---------------|-----------------------------|---------|----------------|
| `auth.spec.ts` | login-auth(13) | 13 | 10 |
| `blog-reading.spec.ts` | blog-navigation(7) + blog-post-detail(7) | 14 | 10 |
| `blog-taxonomy.spec.ts` | blog-category(7) + blog-tag(7) + blog-archive(6) | 20 | 12 |
| `blog-content.spec.ts` | blog-pagination(7) + blog-taxonomy-pagination(12) + blog-search-preview(11) + content-images L109/L129/L148/L180(4) | 34 | 16 |
| `admin-dashboard.spec.ts` | admin-posts(dashboard 子集 ~3) | 3 | 3 |
| `admin-posts.spec.ts` | admin-posts(posts/editor 子集 ~8) + admin-post-edit(7) | 15 | 10 |
| `admin-taxonomy.spec.ts` | admin-taxonomy(9) | 9 | 8 |
| `admin-media.spec.ts` | admin-media(7) + content-images L230/L235(2) | 9 | 7 |
| `admin-settings.spec.ts` | admin-settings(21) | 21 | 15 |
| `admin-ai-agents.spec.ts` | admin-ai-agents(14) | 14 | 10 |
| `admin-backup-mcp.spec.ts` | admin-backup-mcp(14) | 14 | 10 |
| `seo-rss.spec.ts` | seo-meta(5) + rss-feed(4) + content-images L91/L100/L209(3) | 12 | 10 |
| **合计** | **19 → 12** | **178** | **~121** |

**合计来源核对**：13+14+20+34+3+15+9+9+21+14+14+12 = 178 ✅

预估测试数减少原因：
- 合并重复的页面加载断言（多个 spec 都测 "heading visible"）
- 合并同一 feature 的微小验证（如 login 页面的 5 个独立元素断言可合并为 1 个 scenario）
- 删除无断言价值的测试（如 "page has theme toggle" 作为独立测试价值低）

**Traceability 要求**：每个目标 spec 完成时，提交 message body 必须附
"旧 test 名 → 新 scenario 名"的全量映射（参见 §5 检查清单）。**无映射不删旧 spec**。

## 4. 迁移优先级与原子提交

### 4.1 原子提交规则

- **每个 commit 最多迁移一个目标 BDD spec**。批次包含多个 spec 时拆成多个 commit。
- 跨 spec 文件拆分（如 content-images）的源测试在 §1.2.1 已预归属，commit
  时按归属一次性迁移到对应目标 spec，不允许"先迁一半"。
- 删除旧 spec 与新 spec 落地必须在同一个 commit 内完成，或在紧接的下一个
  commit 内完成（commit message 显式引用前一个）。
- 单个 commit 必须包含本目标 spec 的完整 traceability 映射表（在 commit body 或同 PR 关联文档中）。

### 4.2 Phase 1：只读博客前台（风险最低）
| 批次 | Spec | 测试数 (旧→新) | 工作量 | 理由 |
|------|------|--------|--------|------|
| 1.1 | `seo-rss.spec.ts` | 12 → 10 | 小 | 纯断言，无交互 |
| 1.2 | `blog-reading.spec.ts` | 14 → 10 | 小 | 只读导航 |
| 1.3 | `blog-taxonomy.spec.ts` | 20 → 12 | 中 | 合并 3 个 spec |
| 1.4 | `blog-content.spec.ts` | 34 → 16 | 中 | 合并 3 个 spec + content-images 4 个灯箱用例 |

### 4.3 Phase 2：认证 + 管理后台只读
| 批次 | Spec | 测试数 (旧→新) | 工作量 | 理由 |
|------|------|--------|--------|------|
| 2.1 | `auth.spec.ts` | 13 → 10 | 小 | 登录页+守卫 |
| 2.2 | `admin-dashboard.spec.ts` | 3 → 3 | 极小 | 仪表盘加载 |
| 2.3 | `admin-settings.spec.ts` | 21 → 15 | 中 | 4 个设置子页面 |
| 2.4 | `admin-backup-mcp.spec.ts` | 14 → 10 | 小 | 两个只读页面 |

### 4.4 Phase 3：管理后台交互（有 click/fill）
| 批次 | Spec | 测试数 (旧→新) | 工作量 | 理由 |
|------|------|--------|--------|------|
| 3.1 | `admin-taxonomy.spec.ts` | 9 → 8 | 中 | click 创建/编辑表单 |
| 3.2 | `admin-media.spec.ts` | 9 → 7 | 中 | 灯箱交互+keyboard，含 content-images 媒体库 2 例 |
| 3.3 | `admin-ai-agents.spec.ts` | 14 → 10 | 中 | fill 表单 |
| 3.4 | `admin-posts.spec.ts` | 15 → 10 | 大 | 编辑器交互，fill+click |

## 5. 迁移检查清单（每个批次 / 每个目标 spec）

每个目标 spec 落地前按以下步骤执行：

1. **创建 BDD spec 文件**：在 `e2e/bdd/` 下新建
2. **重写测试名称**：全部改为 Given/When/Then 格式
3. **添加步骤注释**：`// Given:` / `// When:` / `// Then:`
4. **Locator 重写**：按 §2.5 优先级（`getByRole` > `getByLabel` >
   `getByTestId` > `getByText` > `locator`），CSS fallback 必须加注释说明
5. **提取共享代码**：重复的导航/断言逻辑提到 `fixtures.ts`，遵守 §2.4 边界
6. **空数据条件**：把 `if (count === 0) return;` 改为
   `test.skip(gate.skip, gate.reason)` 调用 `emptyDataGate`
7. **合并微测试**：同一 scenario 的多个微断言合并
8. **Traceability 映射**：在 commit body 或同 PR 关联文档中写
   "旧 test 名 → 新 scenario 名"全量表，无遗漏则可删旧 spec
9. **删除旧 spec**：确认 §6.2 临时 testMatch 仍能跑通后删除对应旧文件
10. **验证三件套**：
    - `bun run lint`
    - `bun run typecheck`
    - `bunx playwright test --config e2e/playwright.config.ts --list`（确认新 spec 被 Playwright 收集；不能用 `bun run test:e2e:browser -- --list`，因为 `scripts/run-e2e.ts` 不透传 Playwright 参数）
    - `bun run test:e2e:browser`（全量通过）

## 6. CI 迁移

### 6.1 当前 CI 架构

firefly CI 使用**自建 L3 job**，因为需要：
- 启动 Cloudflare Worker（D1 本地模拟）
- 启动 Next.js dev server
- Apply 数据库迁移
- 设置 E2E 环境变量（`E2E_SKIP_AUTH`, `E2E_R2_LOCAL_DIR`）

这些需求使得 base-ci 的 `enable-l3` + `l3-command` 模式**不适用**。firefly 的 L3 CI 保持自建 job。

### 6.2 BDD 迁移期间的 `playwright.config.ts` 演化（三阶段）

**Stage 0（重构前，当前）**：

```ts
// e2e/playwright.config.ts
testDir: "./browser",
```

**Stage 1（迁移期，旧/新并存）**：在创建任何 `e2e/bdd/` spec 之前，先
落一个**配置变更 commit**，让 Playwright 同时收集 `browser/` 和 `bdd/`
两个目录。这是为了避免新 spec 写完却"在 CI 里不存在"的情况。

```ts
// e2e/playwright.config.ts
testDir: "./",
testMatch: ["browser/**/*.spec.ts", "bdd/**/*.spec.ts"],
```

在此阶段，每删除一个旧 spec，新 spec 即生效；CI 命令
`bun run test:e2e:browser` 不变，但实际跑的是两个目录的并集。

**Stage 2（迁移完成）**：所有旧 spec 已删除、`e2e/browser/` 目录已空后，
落一个**收尾 commit**，把 testDir 收敛到 `./bdd`，并删除空的 `browser/` 目录。

```ts
// e2e/playwright.config.ts
testDir: "./bdd",
```

`bun run test:e2e:browser` 命令、`scripts/run-e2e.ts` 启动器、CI job 定义在
三个 stage 内均不需要变更。

### 6.3 CI 命令统一

Stage 2 完成后，在 `package.json` 添加别名：

```json
"test:e2e:bdd": "bun run test:e2e:browser"
```

保持与其他项目的命名一致性。原命令保留，避免破坏 CI / 文档引用。

## 7. 工作量估算

| Phase | Spec 数 | 测试数 | 预估工时 | SDE Issue 数 |
|-------|---------|--------|---------|-------------|
| 准备工作 | 0 | 0 | 0.5h | 1（创建 fixtures.ts + Stage 1 config commit） |
| Phase 1 | 4 | 48 | 2h | 4（每个目标 spec 一个 commit） |
| Phase 2 | 4 | 38 | 1.5h | 4 |
| Phase 3 | 4 | 38 | 2.5h | 4 |
| 收尾 | 0 | 0 | 0.5h | 1（Stage 2 config + 删空目录 + 添加 alias） |
| **合计** | **12** | **~121** | **~7h** | **14** |

## 8. 约束与风险

### 8.1 不变量（baseline 数字均可复跑验证）

| 不变量 | Baseline | 验证命令 |
|--------|----------|---------|
| `scripts/run-e2e.ts` 启动器不改 | — | `git diff main -- scripts/run-e2e.ts` 必须为空 |
| `e2e/playwright.config.ts` 位置不变 | — | 文件路径不变，只改 `testDir`/`testMatch` |
| L2 API 测试数 | 24 spec files / 191 tests | `find e2e/api -name '*.test.ts' \| wc -l`；`find e2e/api -name '*.test.ts' -exec grep -hcE '^\s*(test\|it)\(' {} + \| awk '{s+=$1} END {print s}'` |
| Worker 测试数 | 2 test files / 96 tests | `find worker/test -name '*.test.ts' \| wc -l`；`find worker/test -name '*.test.ts' -exec grep -hcE '^\s*(test\|it)\(' {} + \| awk '{s+=$1} END {print s}'` |
| L3 browser baseline | 19 spec files / 178 tests | `grep -cE '^\s*test\(' e2e/browser/*.spec.ts \| awk -F: '{s+=$2} END {print s}'` |
| CI 自建 job 结构 | — | `.github/workflows/` 中 L3 job 步骤数不变 |

### 8.2 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 合并 spec 时遗漏边界断言 | 覆盖率回退 | 每批次必须附 traceability 映射表，差值必须可解释 |
| 条件跳过逻辑不一致 | 报告里看不到跳过原因 | 统一用 `emptyDataGate` + Playwright `test.skip()` |
| Stage 1 期间旧/新并存导致重复执行 | CI 时长上涨、报告噪音 | 跨阶段命名不冲突；每删一个旧 spec 同 commit 落地新 spec，缩短并存窗口 |
| 10 workers 并行下新 spec 的 flaky | CI 不稳定 | `retries: 1` 已配置；新 spec 先在 `workers: 1` 本地验证 |
| `content-images` 拆分时遗漏归属 | 9 个测试少跑或重跑 | §1.2.1 显式归属表是源代码删除的前置条件 |
| **数据污染 / 并行写入冲突** | Flaky 或 cross-test pollution | 有 `.fill()` / `.click()` 写入操作的 spec（admin-ai-agents、admin-posts、admin-taxonomy、admin-media、admin-post-edit）必须使用唯一前缀（如 `e2e-<spec>-${Date.now()}-`）避免命名冲突；优先以 read-after-write 在同一 test 内验证，不依赖跨 test 的数据状态 |
| Locator 重写引入断言点漂移 | 行为覆盖偏移 | §2.5 列表为强制，CSS fallback 必须加注释；review 时对照旧 spec 的断言目标 |

## 9. 验收标准

- [ ] §1.1 / §1.2 / §1.2.1 / §3 的数字与 §8.1 验证命令的输出完全一致
- [ ] 所有原 178 个测试的行为覆盖被保留（按 §1.2.1 归属 + §3 合并表追溯，允许合并，不允许遗漏）
- [ ] 每个目标 spec commit body 含 "旧 test 名 → 新 scenario 名" 全量映射表
- [ ] 所有 test 名称符合 Given/When/Then 格式
- [ ] 所有 test 包含 `// Given:` / `// When:` / `// Then:` 步骤注释
- [ ] 所有 `describe` 使用 `Feature: <...>` 前缀
- [ ] 所有 selector 符合 §2.5 优先级，CSS fallback 必须有解释注释
- [ ] 共享 fixtures 提取到 `e2e/bdd/fixtures.ts`，遵守 §2.4 边界
- [ ] 空数据处理统一通过 `emptyDataGate` + `test.skip()`，无残留 `if (...) return;`
- [ ] `bun run lint` / `bun run typecheck` 通过
- [ ] `bunx playwright test --config e2e/playwright.config.ts --list` 输出包含全部新 spec、不包含已删旧 spec
- [ ] `bun run test:e2e:browser` 全量通过（178 → ~121 tests，CI green）
- [ ] `package.json` 有 `test:e2e:bdd` 别名
- [ ] 旧 `e2e/browser/` 目录完全删除
- [ ] `playwright.config.ts` 最终 `testDir: "./bdd"`（Stage 2）
