# Firefly L3 → BDD 重构方案

## 1. 存量分析

### 1.1 测试规模

| 指标 | 数值 |
|------|------|
| Spec 文件数 | 19 |
| 测试用例总数 | 180 |
| 管理后台域 (admin-*) | 7 spec, 83 tests |
| 认证域 (login-auth) | 1 spec, 13 tests |
| 博客前台域 (blog-*) | 7 spec, 56 tests |
| 内容/媒体域 (content-*, rss-*, seo-*) | 4 spec, 28 tests |
| **合计** | **19 spec, 180 tests** |

### 1.2 Spec 文件清单

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
| `blog-archive` | 8 | Blog | 归档索引页 |
| `blog-category` | 7 | Blog | 分类页面 |
| `blog-navigation` | 7 | Blog | 首页导航、文章卡片 |
| `blog-pagination` | 7 | Blog | 首页分页 |
| `blog-post-detail` | 7 | Blog | 文章详情页 |
| `blog-search-preview` | 11 | Blog | 搜索页面、预览页面 |
| `blog-tag` | 7 | Blog | 标签页面 |
| `blog-taxonomy-pagination` | 12 | Content | 分类/标签/归档分页 |
| `content-images` | 9 | Content | 图片优化、灯箱、媒体库灯箱 |
| `rss-feed` | 4 | Content | RSS 订阅源 |
| `seo-meta` | 5 | Content | SEO meta 标签、JSON-LD 结构化数据 |

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
3. **条件跳过逻辑重复**：多个 blog-* spec 都有 `if ((await xxx.count()) === 0) return;` 模式处理空数据库
4. **CSS 定位器脆弱**：大量使用 `page.locator("aside, nav")`, `page.locator("h1, h2")` 等 fallback 选择器，说明 UI 结构不够稳定
5. **CI 非标准**：使用自建 job 而非 base-ci `enable-l3`，因为需要启动 Worker + Next.js 双进程

## 2. BDD 目标架构

### 2.1 方案选型

采用 **方案 B：L3 原地升级为 BDD**，与其他 personal 项目保持一致。

技术选型：**Playwright 原生 BDD**（Given/When/Then 命名约定 + 结构化步骤注释），不引入 `playwright-bdd` / `cucumber` 等额外依赖。理由：
- Firefly 的 180 个测试都是 Playwright 原生写法，引入 .feature 文件的改写成本过高
- 其他已完成项目（dove/lyre/backy/gecko/neo/noheir/wooly/otter/pew-game）也使用的是 Playwright 原生 BDD 命名
- 保持依赖最小化

### 2.2 目录结构迁移

```
e2e/
├── browser/              # 当前（重构后删除）
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
├── playwright.config.ts  # 更新 testDir
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
  await expect(page.locator("article").first()).toBeVisible();
});
```

**describe 名称**：`"Feature: <功能域>"`

```typescript
// ❌ 当前风格
test.describe("Blog navigation", () => { ... });

// ✅ BDD 风格
test.describe("Feature: Blog Reading", () => { ... });
```

### 2.4 共享 Fixtures

提取公共辅助到 `e2e/bdd/fixtures.ts`：

```typescript
import { test as base, expect, type Page } from "@playwright/test";

/** Navigate to the first published post from home. Returns false if no posts. */
export async function gotoFirstPost(page: Page): Promise<boolean> { ... }

/** Navigate to admin and ensure sidebar is visible. */
export async function gotoAdmin(page: Page, path = ""): Promise<void> { ... }

/** Skip test if element count is zero (empty test DB). */
export function skipIfEmpty(count: number): void { ... }

export { base as test, expect };
```

## 3. Spec 合并计划

当前 19 个 spec 有些过于细分，合并到 12 个 BDD spec：

| 目标 BDD Spec | 合并来源 | 原测试数 | 预估 BDD 测试数 |
|---------------|---------|---------|----------------|
| `auth.spec.ts` | login-auth | 13 | 10 |
| `blog-reading.spec.ts` | blog-navigation + blog-post-detail | 14 | 10 |
| `blog-taxonomy.spec.ts` | blog-category + blog-tag + blog-archive | 22 | 12 |
| `blog-content.spec.ts` | blog-pagination + blog-taxonomy-pagination + blog-search-preview | 30 | 15 |
| `admin-dashboard.spec.ts` | admin-posts (dashboard 部分) | 3 | 3 |
| `admin-posts.spec.ts` | admin-posts (posts/editor 部分) + admin-post-edit | 15 | 10 |
| `admin-taxonomy.spec.ts` | admin-taxonomy | 9 | 8 |
| `admin-media.spec.ts` | admin-media + content-images (media 部分) | 16 | 10 |
| `admin-settings.spec.ts` | admin-settings | 21 | 15 |
| `admin-ai-agents.spec.ts` | admin-ai-agents | 14 | 10 |
| `admin-backup-mcp.spec.ts` | admin-backup-mcp | 14 | 10 |
| `seo-rss.spec.ts` | seo-meta + rss-feed + content-images (优化部分) | 18 | 12 |
| **合计** | **19 → 12** | **180** | **~125** |

预估测试数减少原因：
- 合并重复的页面加载断言（多个 spec 都测 "heading visible"）
- 合并同一 feature 的微小验证（如 login 页面的 5 个独立元素断言可合并为 1 个 scenario）
- 删除无断言价值的测试（如 "page has theme toggle" 作为独立测试价值低）

## 4. 迁移优先级

按**风险从低到高**排列，先迁移只读测试，后迁移有写入操作的：

### Phase 1：只读博客前台（风险最低）
| 批次 | Spec | 测试数 | 工作量 | 理由 |
|------|------|--------|--------|------|
| 1.1 | `seo-rss.spec.ts` | 9 → 12 | 小 | 纯断言，无交互 |
| 1.2 | `blog-reading.spec.ts` | 14 → 10 | 小 | 只读导航 |
| 1.3 | `blog-taxonomy.spec.ts` | 22 → 12 | 中 | 合并 3 个 spec |
| 1.4 | `blog-content.spec.ts` | 30 → 15 | 中 | 合并 3 个 spec，含分页逻辑 |

### Phase 2：认证 + 管理后台只读
| 批次 | Spec | 测试数 | 工作量 | 理由 |
|------|------|--------|--------|------|
| 2.1 | `auth.spec.ts` | 13 → 10 | 小 | 登录页+守卫 |
| 2.2 | `admin-dashboard.spec.ts` | 3 → 3 | 极小 | 仪表盘加载 |
| 2.3 | `admin-settings.spec.ts` | 21 → 15 | 中 | 4 个设置子页面 |
| 2.4 | `admin-backup-mcp.spec.ts` | 14 → 10 | 小 | 两个只读页面 |

### Phase 3：管理后台交互（有 click/fill）
| 批次 | Spec | 测试数 | 工作量 | 理由 |
|------|------|--------|--------|------|
| 3.1 | `admin-taxonomy.spec.ts` | 9 → 8 | 中 | click 创建/编辑表单 |
| 3.2 | `admin-media.spec.ts` | 16 → 10 | 中 | 灯箱交互+keyboard |
| 3.3 | `admin-ai-agents.spec.ts` | 14 → 10 | 中 | fill 表单 |
| 3.4 | `admin-posts.spec.ts` | 15 → 10 | 大 | 编辑器交互，fill+click |

## 5. 迁移检查清单（每个批次）

每个批次按以下步骤执行：

1. **创建 BDD spec 文件**：在 `e2e/bdd/` 下新建
2. **重写测试名称**：全部改为 Given/When/Then 格式
3. **添加步骤注释**：`// Given:` / `// When:` / `// Then:`
4. **提取共享代码**：重复的导航/断言逻辑提到 `fixtures.ts`
5. **合并微测试**：同一 scenario 的多个微断言合并
6. **删除旧 spec**：确认新 spec 通过后删除对应旧文件
7. **验证**：`bun run test:e2e:browser` 全量通过

## 6. CI 迁移

### 6.1 当前 CI 架构

firefly CI 使用**自建 L3 job**，因为需要：
- 启动 Cloudflare Worker（D1 本地模拟）
- 启动 Next.js dev server
- Apply 数据库迁移
- 设置 E2E 环境变量（`E2E_SKIP_AUTH`, `E2E_R2_LOCAL_DIR`）

这些需求使得 base-ci 的 `enable-l3` + `l3-command` 模式**不适用**。firefly 的 L3 CI 保持自建 job。

### 6.2 BDD 迁移后的 CI 变更

```yaml
# 只需更新 playwright.config.ts 的 testDir
# e2e/playwright.config.ts
testDir: "./bdd"  # 从 "./browser" 改为 "./bdd"
```

`bun run test:e2e:browser` 命令、`scripts/run-e2e.ts` 启动器、CI job 定义均不需要变更。

### 6.3 CI 命令统一

迁移完成后，在 `package.json` 添加别名：
```json
"test:e2e:bdd": "bun run test:e2e:browser"
```

保持与其他项目的命名一致性。

## 7. 工作量估算

| Phase | Spec 数 | 测试数 | 预估工时 | SDE Issue 数 |
|-------|---------|--------|---------|-------------|
| 准备工作 | 0 | 0 | 0.5h | 1（创建 fixtures.ts + 更新 config） |
| Phase 1 | 4 | 49 | 2h | 2 |
| Phase 2 | 4 | 38 | 1.5h | 2 |
| Phase 3 | 4 | 38 | 2.5h | 2 |
| **合计** | **12** | **~125** | **~6.5h** | **7** |

## 8. 约束与风险

### 不变量
- `scripts/run-e2e.ts` 启动器不改
- `e2e/playwright.config.ts` 位置不变（只改 `testDir`）
- L2 API 测试 (`e2e/api/`) 不受影响
- Worker 测试不受影响
- CI 自建 job 结构不变

### 风险
| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 合并 spec 时遗漏边界断言 | 覆盖率回退 | 每批次迁移后对比 test count，差值必须可解释 |
| 条件跳过逻辑不一致 | CI 环境不通过 | 统一提取到 fixtures.ts 的 skipIfEmpty |
| testDir 切换期间新旧并存 | 部分测试重复执行 | 渐进切换：旧 spec 用 `.skip` 禁用，新 spec 验证通过后再删旧文件 |
| 10 workers 并行下新 spec 的 flaky | CI 不稳定 | retries: 1 已配置；新 spec 先在 workers:1 下验证 |

## 9. 验收标准

- [ ] 所有 180 个原测试的行为覆盖被保留（允许合并，不允许遗漏）
- [ ] 所有 test 名称符合 Given/When/Then 格式
- [ ] 所有 test 包含 `// Given:` / `// When:` / `// Then:` 步骤注释
- [ ] 共享 fixtures 提取到 `e2e/bdd/fixtures.ts`
- [ ] `bun run test:e2e:browser` 全量通过（180 → ~125 tests，CI green）
- [ ] `package.json` 有 `test:e2e:bdd` 别名
- [ ] 旧 `e2e/browser/` 目录完全删除
