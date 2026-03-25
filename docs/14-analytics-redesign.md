# 14 — Analytics Dashboard Redesign

> 从"总量概览"转向"多维度分源分析"，按人类访客、搜索引擎、AI Bot、其他 Bot 四类来源独立呈现数据。

## 1. Background

当前 Dashboard 设计于博客上线初期，以传统"总量 + 趋势图 + Top Posts + Referrers"为核心。随着站点运行，实际流量结构发生了根本变化：

- **Search Engine 和 AI Bot 成为主要流量来源**，人类访客反而是少数
- 现有 Dashboard 把所有流量混在一起，无法区分"哪些是 Googlebot 在爬"、"哪些是 GPTBot 在抓"、"哪些是真人在读"
- 几个关键数据管道断裂（`post_id` 始终为 null、聚合表无增量更新、`city` 未采集）

**核心目标：把流量分成四类来源，分别看它们在做什么。**

## 2. Problem Statement

### 2.1 Dashboard 问题

| 问题 | 现状 | 影响 |
|------|------|------|
| 混合视角 | 所有 views 混在一起，bot 只在底部小面板展示 | 无法判断真实读者量 |
| 无来源分层 | 没有按 search / ai / human / other 分维度 | 无法理解流量结构 |
| 文章粒度缺失 | `page_views.post_id` 始终为 null | Top Posts 只有 WP 迁移的历史数据 |
| 聚合表停滞 | `daily_stats`、`site_daily_stats` 无增量更新 | Overview 和趋势图只展示 WP 迁移数据 |
| 路径级分析 | 只有 path，不知道哪条 path 对应哪篇文章 | 无法做内容分析 |
| GET API 无鉴权 | `GET /api/analytics` 不受 proxy auth 保护 | 分析数据对外公开暴露 |

### 2.2 数据管道问题

| 问题 | 文件 | 原因 |
|------|------|------|
| `post_id` 永远为 null | `src/proxy.ts:126` | Middleware 层不知道 path→post 映射 |
| `city` 永远为 null | `src/proxy.ts:134` | 没有读取 `cf-ipcity` header |
| `session_id` 未实现 | `src/lib/tracking.ts:35` | 没有 cookie/session 机制 |
| `posts.view_count` 不更新 | `src/data/analytics.ts:30` | `recordPageView` 不触发 counter 更新 |
| 聚合表无增量 | — | 缺少 cron job 或 Cloudflare Scheduled Worker |

## 3. Design: Four-Source Analytics

### 3.1 来源分类体系

将所有流量严格分为四类：

```
┌─────────────────────────────────────────────────────────┐
│                    All Traffic                          │
├──────────┬──────────┬──────────┬────────────────────────┤
│  Human   │  Search  │  AI Bot  │      Other Bot         │
│  Visitor │  Engine  │          │  (social/monitor/other) │
├──────────┼──────────┼──────────┼────────────────────────┤
│ is_bot=0 │ is_bot=1 │ is_bot=1 │ is_bot=1               │
│          │ cat=     │ cat=ai   │ cat=social/monitor/     │
│          │ search   │          │ other/NULL              │
└──────────┴──────────┴──────────┴────────────────────────┘
```

分类规则基于已有的 `is_bot` + `bot_category` 字段，不需要改 schema。

**NULL 安全规则**：`bot_category` 可以为 NULL（generic bot 匹配时仍写入 `"other"`，但历史数据或未来边界情况可能为 NULL）。所有 SQL 中 Other Bot 的条件统一使用：

```sql
is_bot = 1 AND COALESCE(bot_category, 'other') NOT IN ('search', 'ai')
```

此规则全文档一致，确保 `bot_category IS NULL` 的行不会被漏掉。

### 3.2 Dashboard 整体布局

```
┌─────────────────────────────────────────────────────────┐
│  Period: [7d] [30d] [90d]                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─ Overview ─────────────────────────────────────────┐ │
│  │  Total │ Human │ Search │ AI Bot │ Other Bot       │ │
│  │  Views │ Views │ Crawls │ Crawls │ Hits            │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Traffic Trend (Stacked Area) ─────────────────────┐ │
│  │  四种颜色分别表示 Human / Search / AI / Other       │ │
│  │  可以清晰看到每天的流量组成                          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Source Tabs ──────────────────────────────────────┐ │
│  │  [Human] [Search] [AI Bot] [Other]                 │ │
│  │                                                    │ │
│  │  ← 切换 Tab 时请求 /api/analytics/source →         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Aggregates ───────────────────────────────────────┐ │
│  │  Countries │ Platforms (OS) │ Browsers             │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Overview 统计卡片（5 张）

| 卡片 | SQL 条件 |
|------|----------|
| **Total Views** | `COUNT(*)` |
| **Human Views** | `is_bot = 0` |
| **Search Crawls** | `is_bot = 1 AND bot_category = 'search'` |
| **AI Crawls** | `is_bot = 1 AND bot_category = 'ai'` |
| **Other Bot Hits** | `is_bot = 1 AND COALESCE(bot_category, 'other') NOT IN ('search', 'ai')` |

每张卡片包含：数字 + 与前一周期对比的 delta 百分比。

**Delta 计算口径**：

- **当期**：最近 N 个 **完整 UTC 自然日**（不含今天未结束的部分），即 `date(viewed_at, 'unixepoch') BETWEEN date('now', '-N days') AND date('now', '-1 day')`
- **前期**：紧邻当期之前的等长 N 天
- **公式**：`delta = (current - previous) / previous * 100`；若 previous = 0 则显示 `NEW`
- **不含今天**的原因：今天还没结束，纳入统计会导致当期数值系统性偏低，delta 失真
- **此口径适用于全局**：Overview、Daily Trend、Source Detail 的所有查询统一使用相同的时间窗口

### 3.4 时间窗口（全局规则）

所有 API 查询统一使用**完整 UTC 自然日**窗口：

```sql
-- 标准时间窗口（所有查询共用）
WHERE date(viewed_at, 'unixepoch') BETWEEN date('now', '-' || ? || ' days') AND date('now', '-1 day')
```

**唯一例外**：Human Tab 的 "Recent 24h" 卡片使用滚动 24 小时窗口（`viewed_at >= unixepoch('now') - 86400`），因为它的目的就是展示实时感知。

### 3.5 Traffic Trend Chart

**Stacked Area Chart**，X 轴为日期，Y 轴为访问量，四种颜色叠加：

- Human（实色填充）
- Search Engine（虚线 + 浅填充）
- AI Bot（虚线 + 浅填充）
- Other Bot（最浅）

**数据来源**：直接从 `page_views` 表按天 GROUP BY，不再依赖 `site_daily_stats` 聚合表。

```sql
SELECT
  date(viewed_at, 'unixepoch') AS date,
  SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS human,
  SUM(CASE WHEN bot_category = 'search' THEN 1 ELSE 0 END) AS search,
  SUM(CASE WHEN bot_category = 'ai' THEN 1 ELSE 0 END) AS ai,
  SUM(CASE WHEN is_bot = 1 AND COALESCE(bot_category, 'other') NOT IN ('search', 'ai') THEN 1 ELSE 0 END) AS other_bot
FROM page_views
WHERE date(viewed_at, 'unixepoch') BETWEEN date('now', '-' || ? || ' days') AND date('now', '-1 day')
GROUP BY date
ORDER BY date ASC
```

### 3.6 补零规则（后端职责）

SQL GROUP BY date 只返回有数据的日期。**后端**在返回前负责补零：

**Summary `daily` 数组**：对 `period.startDate` 到 `period.endDate` 的每一天，保证都有一条记录，缺失日各字段为 0。

```ts
// src/data/analytics.ts — backend utility
function fillDailyGaps(rows: DailyRow[], startDate: string, endDate: string): DailyRow[] {
  const map = new Map(rows.map(r => [r.date, r]));
  const result: DailyRow[] = [];
  for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    result.push(map.get(key) ?? { date: key, human: 0, search: 0, ai: 0, otherBot: 0 });
  }
  return result;
}
```

**Source Detail `dailyByBot` 数组**：按 **bot × date 笛卡尔积**补零。具体规则：

1. 从查询结果中提取出现过的所有 `botName`
2. 对每个 botName，在 `period.startDate` 到 `period.endDate` 的每一天都生成一条记录
3. 缺失的 (botName, date) 组合 count = 0

这确保前端的多折线图中每个 bot 都有完整连续的数据点，不会出现断线。

```ts
function fillDailyByBotGaps(
  rows: { date: string; botName: string; count: number }[],
  startDate: string,
  endDate: string,
): { date: string; botName: string; count: number }[] {
  // 1. Collect all bot names that appeared
  const botNames = [...new Set(rows.map(r => r.botName))];
  // 2. Build lookup: "date|botName" → count
  const lookup = new Map(rows.map(r => [`${r.date}|${r.botName}`, r.count]));
  // 3. Generate cartesian product: every bot × every date
  const result: { date: string; botName: string; count: number }[] = [];
  for (let d = new Date(startDate); d <= new Date(endDate); d.setDate(d.getDate() + 1)) {
    const date = d.toISOString().slice(0, 10);
    for (const botName of botNames) {
      result.push({ date, botName, count: lookup.get(`${date}|${botName}`) ?? 0 });
    }
  }
  return result;
}
```

- **前端直接渲染，不做补零**

### 3.7 Source Tabs — Per-Source Detail

每个 Tab 切换时，请求 `GET /api/analytics/source?type={type}&days={days}`，获取该来源的专属数据。

#### Tab 1: Human Visitors

| 面板 | 内容 | 说明 |
|------|------|------|
| **Top Pages** | 按 path GROUP BY，LEFT JOIN posts 获取标题 | 人类真正在读什么 |
| **Top Referrers** | referrer 来源 | 从哪来的（Google 搜索结果、社交分享、直接访问） |
| **Device Split** | Desktop / Mobile / Tablet 饼图 | 设备分布 |
| **Browser Split** | Chrome / Safari / Firefox 等 | 浏览器分布 |
| **OS Split** | macOS / Windows / iOS / Android | 操作系统分布 |
| **Country** | 国家分布（条形图） | 按 `country` 字段 |
| **Recent 24h** | 最近 24 小时人类访问量 | 实时感知（滚动窗口，见 §3.4） |

#### Tab 2: Search Engine

| 面板 | 内容 | 说明 |
|------|------|------|
| **Bot Breakdown** | Googlebot / Bingbot / YandexBot 等 | 哪些搜索引擎在爬 |
| **Top Crawled Pages** | 搜索引擎爬过的页面排名 | 哪些内容被索引得最多 |
| **Crawl Timeline** | 按天的爬取频率（按 bot 分线） | 搜索引擎的关注度趋势 |
| **Crawler vs Page** | 交叉表：哪个 bot 爬了哪些页面 | 理解不同引擎的偏好 |

#### Tab 3: AI Bot

| 面板 | 内容 | 说明 |
|------|------|------|
| **Bot Breakdown** | GPTBot / ClaudeBot / PerplexityBot 等 | 哪些 AI 在抓 |
| **Top Crawled Pages** | AI 爬过的页面排名 | 哪些内容被 AI 训练/检索 |
| **Crawl Timeline** | 按天的爬取频率（按 bot 分线） | AI 兴趣趋势 |
| **AI Bot Comparison** | 多条线对比不同 AI bot 的活跃度 | GPTBot vs ClaudeBot vs Perplexity |

#### Tab 4: Other Bots

| 面板 | 内容 | 说明 |
|------|------|------|
| **Bot Breakdown** | social / monitor / other 三类 | 分类概览 |
| **Social Preview** | Facebook / Twitter / LinkedIn 等 | 社交平台的预览拉取 |
| **Monitor Activity** | UptimeRobot / Pingdom 等 | 监控工具频率 |
| **Unknown Bots** | 未分类的 bot UA 列表 | 发现新 bot 模式 |

### 3.8 Top Pages 标题回退规则

Top Pages 面板通过 path 解析 slug，LEFT JOIN posts 获取文章标题。但以下情况 title 为 null：

- **历史数据**：post_id 修复前的 page_views 行没有 post_id
- **非文章路径**：首页 `/`、分类页 `/category/xxx`、标签页 `/tag/xxx` 等
- **路径无法解析为 slug**：path 不匹配 `/{year}/{month}/{slug}` 格式

**回退规则（后端实现）**：后端负责 fallback，返回给前端的 `title` 字段永远非空。

```ts
// src/data/analytics.ts — title fallback helper
function formatPathAsTitle(path: string): string {
  if (path === "/") return "Homepage";
  // /2024/03/my-article → "my-article"
  // /category/tech → "category / tech"
  // /tag/ai → "tag / ai"
  return path.replace(/^\//, "").replace(/\/$/, "").replace(/\//g, " / ");
}
```

**SQL 实现**：

```sql
SELECT
  pv.path,
  COALESCE(p.title, pv.path) AS title,  -- SQL-level coalesce, TS-level formatPathAsTitle
  COUNT(*) AS views
FROM page_views pv
LEFT JOIN posts p ON p.slug = :extracted_slug AND p.status = 'published'
WHERE ...
```

slug 提取在 TypeScript 层完成（见 §4.2），不在 SQL 中做字符串操作。SQL 的 `COALESCE(p.title, pv.path)` 保底返回 path，TypeScript 代码再对 path fallback 调用 `formatPathAsTitle()`。

**前端渲染**：
- 所有行都显示 `title`（后端已保证非空）
- 文章路径的行可点击跳转（后端额外返回 `isPost: boolean` 标记）
- 非文章路径的行不可点击，文字用 muted 颜色

### 3.9 Aggregates（跨来源聚合面板）

始终显示在页面底部，由 summary endpoint 返回，展示全部流量的聚合维度：

| 面板 | 内容 | 数据条件 |
|------|------|----------|
| **Countries** | 国家分布条形图 | 全部 page_views，按 country GROUP BY |
| **Platforms (OS)** | 操作系统分布 | 仅 is_bot=0（bot 的 OS 无意义） |
| **Browsers** | 浏览器分布 | 仅 is_bot=0 |

## 4. Data Pipeline Fixes

### 4.1 Tracking 可靠性策略

**现状**：tracking 在 proxy middleware 中以 fire-and-forget 方式触发（`trackPageView(...).catch(() => {})`），属于 best-effort。这意味着：

- 如果 D1 写入失败或超时，该 page view 直接丢失
- Vercel Serverless Function 在返回 response 后可能立即终止，异步操作不保证执行完毕

**本轮策略：明确接受"统计非强一致"**

理由：
1. 个人博客的分析数据不需要金融级精度，丢失少量 page views 可接受
2. 引入 `waitUntil`（Vercel Edge Runtime）或消息队列（如 Cloudflare Queue）增加架构复杂度，收益不大
3. 当前 fire-and-forget 已经能记录绝大多数 page views

**约束**：新增的 `resolvePostId` 查询不应显著降低 tracking 成功率。解决方案：

- `resolvePostId` 使用进程级缓存，绝大多数请求命中缓存，无额外 DB 查询
- 缓存未命中时查一次 DB；如果查询失败，`postId` 降级为 null（不影响整条 page_view 的写入）
- `view_count` 更新独立于 `recordPageView`：如果 UPDATE 失败，INSERT page_view 不受影响

**未来优化路径**（Out of Scope）：
- 迁移到 Vercel Edge Runtime 使用 `waitUntil()` 确保异步完成
- 使用 Cloudflare Queue 解耦写入

### 4.2 Fix: post_id Mapping

**问题**：`proxy.ts` 在 middleware 层不知道 path→post 映射。

**文章路由格式**：`/{year}/{month}/{slug}`（见 `src/lib/seo.ts:150 postPath()` 和 `src/app/(blog)/[year]/[month]/[slug]/page.tsx`）。

**方案**：在 `trackPageView` 中增加 path→post_id 的异步解析。

```
src/lib/tracking.ts
├── trackPageView()
│   └── NEW: resolvePostId(db, path) → postId | null
│       ├── 1. 用正则提取 slug: path.match(/^\/\d{4}\/\d{2}\/([^/]+)\/?$/)
│       │   └── 不匹配 → 返回 null（首页、分类页等非文章路径）
│       ├── 2. 查进程级缓存 slugCache
│       │   └── 命中 → 返回缓存值
│       └── 3. 查 DB: SELECT id FROM posts WHERE slug = ? AND status = 'published'
│           ├── 查到 → 写入缓存，返回 postId
│           └── 查询失败 → 返回 null（降级，不阻断 tracking）
```

**路径规则**：
- `/{year}/{month}/{slug}` → 正则提取 slug → 查 posts 表（**注意**：不是 `/posts/{slug}`）
- `/` → null（首页）
- `/category/*`、`/tag/*`、`/page/*` → null
- 任何不匹配正则的路径 → null

**缓存策略**：使用项目已有的 `createCache<T>(ttl)` 工具（`src/lib/cache.ts`），创建 `createCache<Map<string, string | null>>(5 * 60 * 1000)`，TTL 5 分钟，与 redirect cache 的实际 TTL 一致。整个 slug→postId 映射表作为一个 Map 缓存，缓存过期后重建。

**文件改动**：
- `src/lib/tracking.ts` — 增加 `resolvePostId()` 函数
- `src/proxy.ts` — 无需改动（tracking.ts 内部处理）

### 4.3 Fix: city Field

**问题**：`proxy.ts:134` 硬编码 `city: null`。

**方案**：读取 Cloudflare 的 `cf-ipcity` header。

```ts
// src/proxy.ts
city: request.headers.get("cf-ipcity") ?? null,
```

**注意**：`cf-ipcity` 仅在 Cloudflare 边缘节点可用。如果站点通过 Vercel 部署（非 Cloudflare），此 header 不存在，city 仍为 null。这是可接受的降级。

**文件改动**：`src/proxy.ts`（1 行）

### 4.4 Fix: posts.view_count

**问题**：`recordPageView` 不更新 posts 表的 view_count。

**方案**：在 `recordPageView` 中，如果 postId 存在且 is_bot=false，额外执行：

```sql
UPDATE posts SET view_count = view_count + 1 WHERE id = ?
```

**一致性预期**：`posts.view_count` 是**缓存型字段，接受最终一致**。

- `view_count` 与 `page_views` 表中实际记录数可能存在漂移（UPDATE 失败但 INSERT 成功）
- 这个字段仅用于前端文章列表的快速排序/展示，不作为精确统计来源
- 精确统计始终以 `COUNT(*) FROM page_views WHERE post_id = ?` 为准
- `recordPageView` 中 INSERT 和 UPDATE 是两条独立语句，UPDATE 失败不应回滚 INSERT

**文件改动**：`src/data/analytics.ts` — `recordPageView()` 增加条件更新

### 4.5 Fix: Analytics API Auth

**问题**：`src/proxy.ts` 只保护 `/admin` 前缀路由和写方法（POST/PUT/DELETE/PATCH）的 API。`GET /api/analytics` 是读操作，不走 auth guard，实际对外公开。API route 注释写 "Protected by proxy" 但代码不成立。

**方案**：在 `isProtectedApiRoute` 中增加对 analytics 读接口的保护。

```ts
// src/proxy.ts — isProtectedApiRoute()
function isProtectedApiRoute(pathname: string, method: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/api/auth/")) return false;
  if (pathname === "/api/mcp" || pathname.startsWith("/api/mcp/")) return false;
  // Analytics endpoints require admin auth for all methods
  if (pathname.startsWith("/api/analytics")) return true;
  return PROTECTED_API_METHODS.includes(method);
}
```

**文件改动**：`src/proxy.ts` — `isProtectedApiRoute()` 增加一行条件

### 4.6 Decision: Aggregation Tables

**问题**：`daily_stats` 和 `site_daily_stats` 没有增量更新机制。

**方案选择**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| A. Scheduled Worker（Cloudflare Cron Trigger） | 真正的定时任务，隔离 | 需要额外部署 Worker |
| B. 弃用聚合表，改为实时查 page_views | 架构简单，数据永远准确 | 大量数据时查询慢 |
| **C. API 端查询时 on-the-fly 聚合（推荐）** | 不需要额外基础设施，数据实时 | 查询稍慢但 D1 可接受 |

**采用方案 C**：

- Dashboard API 直接从 `page_views` 表实时聚合
- 不再依赖 `site_daily_stats` 和 `daily_stats`
- 如果将来 page_views 数据量太大（>100 万行），再考虑引入 Cron 聚合
- 保留聚合表 schema，但暂时不填充、不读取

**理由**：个人博客流量规模有限，D1 对几十万行的聚合查询在 100ms 内可返回。过早优化不如保持简单。

## 5. API Design

### 5.1 策略：直接改现有接口

不引入 v2 概念。直接重写 `GET /api/analytics`，同时新增 `GET /api/analytics/source`。前后端同步改，旧 Dashboard 整体替换。

**理由**：站点仍在第一版调整期，没有外部消费者依赖旧接口 schema。

### 5.2 两个 Endpoint

#### Endpoint 1: Summary（页面初始加载）

```
GET /api/analytics?days=30
```

返回 overview + daily trend + aggregates。页面加载时调用一次。需要 admin auth（见 §4.5）。

#### Endpoint 2: Source Detail（Tab 切换时按需加载）

```
GET /api/analytics/source?type=human&days=30
```

`type` = `human` | `search` | `ai` | `other`

返回该来源的专属详情数据。Tab 切换时调用。需要 admin auth（见 §4.5）。

**前端交互流**：

```
页面加载 → GET /api/analytics?days=30
            → 渲染 Overview + Trend + Aggregates
            → 默认 Tab = Human
            → GET /api/analytics/source?type=human&days=30
            → 渲染 Human Tab 内容

用户点 AI Tab → GET /api/analytics/source?type=ai&days=30
               → 渲染 AI Tab 内容（已请求过的 Tab 缓存在前端 state）

用户切 Period → 清空前端 cache
              → 重新请求 summary + 当前 Tab 的 source detail
```

### 5.3 Summary Response Schema

```ts
interface AnalyticsSummaryResponse {
  overview: {
    total: number;
    human: number;
    search: number;
    ai: number;
    otherBot: number;
    // Delta vs previous period (percentage, null if previous = 0)
    totalDelta: number | null;
    humanDelta: number | null;
    searchDelta: number | null;
    aiDelta: number | null;
    otherBotDelta: number | null;
  };

  // Daily breakdown for trend chart (all dates in range, gaps filled with zeros by backend)
  daily: {
    date: string;      // YYYY-MM-DD
    human: number;
    search: number;
    ai: number;
    otherBot: number;
  }[];

  // Cross-source aggregates
  aggregates: {
    countries: { country: string; count: number }[];
    platforms: { os: string; count: number }[];    // humans only
    browsers: { browser: string; count: number }[]; // humans only
  };

  period: {
    days: number;
    startDate: string;  // inclusive, YYYY-MM-DD
    endDate: string;    // inclusive, YYYY-MM-DD (yesterday)
  };
}
```

### 5.4 Source Detail Response Schemas

```ts
// --- Human ---
interface HumanDetailResponse {
  type: "human";
  topPages: { path: string; title: string; isPost: boolean; views: number }[];
  topReferrers: { referrer: string; views: number }[];
  devices: { deviceType: string; count: number }[];
  browsers: { browser: string; count: number }[];
  os: { os: string; count: number }[];
  countries: { country: string; count: number }[];
  recent24h: number;
}

// --- Search Engine ---
interface SearchDetailResponse {
  type: "search";
  bots: { botName: string; count: number }[];
  topPages: { path: string; title: string; isPost: boolean; views: number }[];
  dailyByBot: { date: string; botName: string; count: number }[];  // for timeline chart, gaps filled
  crawlerVsPage: { botName: string; path: string; title: string; count: number }[];  // cross-table
}

// --- AI Bot ---
interface AiBotDetailResponse {
  type: "ai";
  bots: { botName: string; count: number }[];
  topPages: { path: string; title: string; isPost: boolean; views: number }[];
  dailyByBot: { date: string; botName: string; count: number }[];  // for comparison chart, gaps filled
}

// --- Other Bot ---
interface OtherBotDetailResponse {
  type: "other";
  byCategory: { category: string; count: number }[];
  socialBots: { botName: string; count: number }[];
  monitorBots: { botName: string; count: number }[];
  unknownBots: { botName: string; userAgent: string; count: number }[];
}
```

### 5.5 Query Design

所有查询直接读 `page_views` 表。所有查询使用 §3.4 定义的标准时间窗口（完整 UTC 自然日，不含今天）。

**Overview**：
```sql
-- Current period
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS human,
  SUM(CASE WHEN bot_category = 'search' THEN 1 ELSE 0 END) AS search,
  SUM(CASE WHEN bot_category = 'ai' THEN 1 ELSE 0 END) AS ai,
  SUM(CASE WHEN is_bot = 1 AND COALESCE(bot_category, 'other') NOT IN ('search', 'ai') THEN 1 ELSE 0 END) AS other_bot
FROM page_views
WHERE date(viewed_at, 'unixepoch') BETWEEN date('now', '-' || ? || ' days') AND date('now', '-1 day')

-- Previous period (same structure, shifted back)
-- ...BETWEEN date('now', '-' || (2*?) || ' days') AND date('now', '-' || (? + 1) || ' days')
```

**Daily Trend**：
```sql
SELECT
  date(viewed_at, 'unixepoch') AS date,
  SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS human,
  SUM(CASE WHEN bot_category = 'search' THEN 1 ELSE 0 END) AS search,
  SUM(CASE WHEN bot_category = 'ai' THEN 1 ELSE 0 END) AS ai,
  SUM(CASE WHEN is_bot = 1 AND COALESCE(bot_category, 'other') NOT IN ('search', 'ai') THEN 1 ELSE 0 END) AS other_bot
FROM page_views
WHERE date(viewed_at, 'unixepoch') BETWEEN date('now', '-' || ? || ' days') AND date('now', '-1 day')
GROUP BY date
ORDER BY date ASC
```

后端对结果调用 `fillDailyGaps()` 补零后返回。

**Top Pages with title（后端 TypeScript 层）**：

```ts
// 1. Query page_views grouped by path
const rows = await db.query<{ path: string; views: number }>(
  `SELECT path, COUNT(*) AS views
   FROM page_views
   WHERE date(viewed_at, 'unixepoch') BETWEEN date('now', '-' || ? || ' days') AND date('now', '-1 day')
     AND ${sourceCondition}
   GROUP BY path
   ORDER BY views DESC
   LIMIT 20`,
  [days]
);

// 2. For each path, try to extract slug and resolve title
const ARTICLE_PATH_RE = /^\/(\d{4})\/(\d{2})\/([^/]+)\/?$/;

const result = await Promise.all(rows.results.map(async (row) => {
  const match = row.path.match(ARTICLE_PATH_RE);
  if (match) {
    const slug = match[3];
    const post = await db.firstOrNull<{ title: string }>(
      `SELECT title FROM posts WHERE slug = ? AND status = 'published'`,
      [slug]
    );
    if (post) return { path: row.path, title: post.title, isPost: true, views: row.views };
  }
  return { path: row.path, title: formatPathAsTitle(row.path), isPost: false, views: row.views };
}));
```

> 注：Top Pages 最多 20 行，所以 N+1 查询可接受。如果后续需要优化，可以批量查 `WHERE slug IN (...)`.

**Crawler vs Page（Search Tab 交叉表）**：

```sql
SELECT
  bot_name AS botName,
  path,
  COUNT(*) AS count
FROM page_views
WHERE date(viewed_at, 'unixepoch') BETWEEN date('now', '-' || ? || ' days') AND date('now', '-1 day')
  AND bot_category = 'search'
GROUP BY bot_name, path
ORDER BY count DESC
LIMIT 50
```

后端同样对 path 做 title 回退处理。

## 6. Frontend Implementation

### 6.1 Component Restructuring

当前 Dashboard 是单文件实现（`analytics-dashboard.tsx`, 537 行）。本次改动将其拆分为模块化组件结构：

```
src/components/admin/
├── analytics-dashboard.tsx        ← 重写为 orchestrator（data fetching + layout）
├── analytics/
│   ├── overview-cards.tsx          ← 5 张卡片 + delta
│   ├── traffic-trend.tsx           ← Stacked Area Chart
│   ├── source-tabs.tsx             ← Tab 容器 + lazy loading
│   ├── human-tab.tsx               ← 人类访客详情
│   ├── search-tab.tsx              ← 搜索引擎详情
│   ├── ai-bot-tab.tsx              ← AI Bot 详情
│   ├── other-bot-tab.tsx           ← 其他 Bot 详情
│   ├── aggregates-panel.tsx        ← 国家/平台/浏览器
│   └── chart-helpers.ts            ← 共享：颜色常量、格式化函数
```

这是一次允许的整体组件结构重组。旧的单文件 dashboard 完整替换，不保留。

### 6.2 Data Fetching Strategy

```ts
// analytics-dashboard.tsx
const [summary, setSummary] = useState<SummaryResponse | null>(null);
const [sourceCache, setSourceCache] = useState<Record<string, SourceDetailResponse>>({});
const [activeTab, setActiveTab] = useState<SourceType>("human");

// Initial load: summary + default tab
useEffect(() => {
  fetchSummary(days).then(setSummary);
  fetchSourceDetail("human", days).then(data => setSourceCache(prev => ({ ...prev, human: data })));
}, [days]);

// Tab switch: fetch only if not cached
function handleTabChange(type: SourceType) {
  setActiveTab(type);
  if (!sourceCache[type]) {
    fetchSourceDetail(type, days).then(data => setSourceCache(prev => ({ ...prev, [type]: data })));
  }
}

// Period change: clear cache, re-fetch all
function handlePeriodChange(newDays: number) {
  setDays(newDays);
  setSourceCache({}); // clear tab cache
}
```

### 6.3 交互设计

- **Period Selector**：保留 `[7d] [30d] [90d]`，用 SegmentedControl
- **Source Tabs**：4 个 Tab，默认选中 "Human"
- **Tab 切换**：请求 `/api/analytics/source`；已请求过的 Tab 数据缓存在 state 中，不重复请求
- **Period 切换**：清空 tab cache，重新请求 summary + 当前 active tab 的 detail
- **Loading**：Summary 区域用 Skeleton；Tab 区域切换时独立 loading state
- **i18n**：所有文字走 locale key

### 6.4 图表库

继续使用 `recharts`（已在项目中）。新增的图表类型：

- **Stacked Area Chart** — Traffic Trend（替换现有的三线 AreaChart）
- **Horizontal Bar Chart** — Bot Breakdown、Top Pages
- **Pie/Donut Chart** — Device Split（保留现有）
- **Multi-line Chart** — AI Bot Comparison / Search Crawl Timeline（新增）

## 7. Files to Modify

### Backend

| File | Action | Description |
|------|--------|-------------|
| `src/proxy.ts` | EDIT | 读取 `cf-ipcity` header + analytics auth fix |
| `src/lib/tracking.ts` | EDIT | 增加 `resolvePostId()` + slug cache |
| `src/data/analytics.ts` | EDIT | 增加 view_count 更新、新查询函数、`fillDailyGaps`、`formatPathAsTitle` |
| `src/app/api/analytics/route.ts` | REWRITE | Summary endpoint（替换旧实现） |
| `src/app/api/analytics/source/route.ts` | CREATE | Source detail endpoint |
| `src/models/types.ts` | EDIT | 增加 response 类型定义 |

### Frontend

| File | Action | Description |
|------|--------|-------------|
| `src/components/admin/analytics-dashboard.tsx` | REWRITE | 新的 orchestrator（整体结构重组） |
| `src/components/admin/analytics/*.tsx` | CREATE | 8 个新子组件（见 §6.1） |
| `src/i18n/locales/en.json` | EDIT | 新增 analytics i18n keys |
| `src/i18n/locales/zh.json` | EDIT | 新增 analytics i18n keys |

### Tests

| File | Action | Description |
|------|--------|-------------|
| `src/data/analytics.test.ts` | EDIT | 新查询函数的 unit tests |
| `src/lib/tracking.test.ts` | EDIT | resolvePostId + slug cache tests |
| `e2e/api/analytics.test.ts` | EDIT | 两个 endpoint 的 E2E tests + auth tests |

## 8. Atomic Commits

| # | Commit | Scope |
|---|--------|-------|
| 1 | fix: read cf-ipcity header in proxy | `src/proxy.ts` | ✅ |
| 2 | fix: protect analytics GET endpoints with admin auth | `src/proxy.ts` | ✅ |
| 3 | feat: resolve post_id from path in tracking | `src/lib/tracking.ts` | ✅ |
| 4 | feat: increment posts.view_count on human page view | `src/data/analytics.ts` | ✅ |
| 5 | feat: add analytics summary + source query functions | `src/data/analytics.ts`, `src/models/types.ts` | ✅ |
| 6 | feat: rewrite /api/analytics as summary endpoint | `src/app/api/analytics/route.ts` | ✅ |
| 7 | feat: add /api/analytics/source detail endpoint | `src/app/api/analytics/source/route.ts` | ✅ |
| 8 | feat: chart helpers and shared constants | `src/components/admin/analytics/chart-helpers.ts` | ✅ |
| 9 | feat: analytics overview cards with delta | `src/components/admin/analytics/overview-cards.tsx` | ✅ |
| 10 | feat: stacked area traffic trend chart | `src/components/admin/analytics/traffic-trend.tsx` | ✅ |
| 11 | feat: human visitor detail tab | `src/components/admin/analytics/human-tab.tsx` | ✅ |
| 12 | feat: search engine detail tab | `src/components/admin/analytics/search-tab.tsx` | ✅ |
| 13 | feat: AI bot detail tab | `src/components/admin/analytics/ai-bot-tab.tsx` | ✅ |
| 14 | feat: other bot detail tab | `src/components/admin/analytics/other-bot-tab.tsx` | ✅ |
| 15 | feat: aggregates panel (countries/platforms/browsers) | `src/components/admin/analytics/aggregates-panel.tsx` | ✅ |
| 16 | feat: rewrite analytics dashboard orchestrator | `src/components/admin/analytics-dashboard.tsx` | ✅ |
| 17 | feat: add i18n keys for analytics redesign | `src/i18n/locales/{en,zh}.json` | ✅ |
| 18 | test: add unit + e2e tests for analytics redesign | tests | ✅ |

## 9. Testing

| Layer | Scope | What |
|-------|-------|------|
| **L1 Unit** | query functions | 每个新查询函数 mock Db，验证返回结构和 NULL 安全 |
| **L1 Unit** | resolvePostId | `/{year}/{month}/{slug}` 格式解析、缓存命中/未命中、DB 查询失败降级 |
| **L1 Unit** | fillDailyGaps | 补零逻辑：空范围、完整范围、中间缺日期 |
| **L1 Unit** | fillDailyByBotGaps | bot×date 笛卡尔积补零：多 bot 交叉缺失、单 bot、空数据 |
| **L1 Unit** | formatPathAsTitle | 首页、文章路径、分类页、边界情况 |
| **L1 Unit** | bot detection | 已有 19 cases，无需新增 |
| **L2 Integration** | API auth | GET /api/analytics 未登录返回 401 |
| **L2 Integration** | API routes | 调用两个 endpoint，验证 response schema |
| **L3 E2E** | Dashboard | Playwright 访问 /admin/analytics，验证 Tab 切换、图表渲染 |

## 10. Out of Scope

以下内容本轮不做：

- **session_id 实现** — 需要引入 cookie 机制，复杂度高，后续迭代
- **搜索关键词提取** — Google 不再在 referrer 中暴露 search query，需要集成 Google Search Console API，属于独立 feature
- **聚合表 Cron 更新** — 方案 C 决定暂不依赖聚合表，如果 page_views 表性能成为瓶颈再引入
- **地理地图可视化** — 国家数据用条形图即可，世界地图组件体积大
- **实时 WebSocket 推送** — 个人博客不需要实时 dashboard
- **Tracking 强一致（waitUntil / Queue）** — 见 §4.1 策略，当前 best-effort 可接受
- **AI Bot Crawl Depth** — 没有 session_id 无法可靠推测单次 session 的抓取深度，移至 session_id 实现后
