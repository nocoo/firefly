# 24 — 设计审计与提升机会（2026-06-09）

> 复审时间 2026-06-09，方法论参考 baoyu-design skill 的设计链路：critique → frontend-design → extract → normalize → polish → adapt → harden。
> 上一轮设计审计为 `06-design-review.md`（2026-03-23），中间经历 `23-blog-redesign-lizheng-zed.md` lizheng/zed 改版。本轮聚焦改版后的新问题、未修复项以及系统级的提升机会。

---

## 摘要

Firefly 改版后整体视觉框架已经落地（grain 噪点、cross-divider、page-wrapper、zed footer、cream/深蓝双色），blog 表面调性正确、admin 表面功能完善。但**两套表面在 token 层未真正打通**，**改版引入了少量"AI slop 反模式"残留**（社交链接 135deg 渐变、AI 按钮 emoji 图标），**核心写作/管理流程在反馈层薄弱**（保存失败定位不到字段、批量操作缺关键功能、空状态全是裸文本）。设计系统层有重复、死代码与跨表面泄漏。

**整体设计评级：A−** — 视觉骨架是对的，但需要一轮系统级的 polish 和反馈链路加固。

**如果只投入 1 天，建议优先修复**：A-02（PostForm 错误无字段定位 — 写作核心流程，必须最先）、B-02（404 孤儿页）、A-01（分页无省略号）、S-04（color-scheme），其余视觉一致性问题作为第二波。

---

## 章节索引

- [1. Blog 前台审计](#1-blog-前台审计)（B-01 ~ B-25）
- [2. Admin 后台审计](#2-admin-后台审计)（A-01 ~ A-25）
- [3. 设计系统审计](#3-设计系统审计)（S-01 ~ S-18）
- [4. 设计提升机会汇总](#4-设计提升机会汇总)
- [5. 与 06 报告的对账](#5-与-06-报告的对账)
- [6. 行动建议（建议落盘顺序）](#6-行动建议建议落盘顺序)

---

## 1. Blog 前台审计

改版后整体调性正确，但仍有改版引入或遗漏的细节。

### 1.1 P0 严重（影响视觉一致性 / 可用性 / 核心体验）

| # | 问题 | 位置 | 影响 | 修复方向 |
|---|------|------|------|----------|
| **B-02** | **404 页面是孤儿页** — 不在 `(blog)` 段下，没有 sidebar/footer/page-wrapper/grain 噪点，命中 404 时整个 lizheng 视觉语言全部消失 | `src/app/not-found.tsx` | 核心体验断裂 | 复用 blog-shell + page-wrapper，给 search 入口或最近文章 |

### 1.2 P1 中等

| # | 问题 | 位置 | 影响 | 修复方向 |
|---|------|------|------|----------|
| **B-01** | **社交链接 hover 全是 `linear-gradient(135deg, ...)` 拼色** — 5 个 brand hover 是 AI-slop 风格的 135 度品牌渐变，且色卡硬编码 hex（`#1877f2/#0a66c2/#333/#ea4335/#8b5cf6`），与 lizheng 极简扁平风冲突 | `globals.css:737-741` | 设计语言一致性 | 改为 hover 时纯品牌色填充（无 135deg），或仅切换 border + accent，保持冷静 |
| **B-03** | **PostCard 标题 `text-lg/md:text-xl` 偏小，与详情页 `text-2xl/md:text-3xl` 落差过大** — 列表浏览时标题缺乏视觉锚点，CJK 字号 17px 在 leading-snug 下过密 | `post-card.tsx:32`, `[slug]/page.tsx:142` | 信息层级失衡 | 列表标题升至 `text-xl/md:text-2xl`，`leading-snug` → `leading-tight`（或 1.3）|
| **B-04** | **`.blog-byline-author` 类被引用但 CSS 里没定义** — 两处使用（`post-card:56`、`[slug]:146`），grep 在 globals.css 里 0 命中。改版遗留死类名，说明样式未实际生效 | `post-card.tsx:56`, `[slug]/page.tsx:146` | 死代码 / 设计意图丢失 | 删类名或补上预期样式 |
| **B-05** | **`prefetch={false}` 全站标配** — 8 处全关闭，对极简博客同站内导航损失感知性能（移动端尤甚），rationale 不明 | `post-card.tsx:35,76,103`, `article-nav.tsx:136,148,165`, `blog-footer.tsx:92` | 感知性能 | 默认让 Next 处理（`prefetch={null}`/viewport prefetch），仅 footer/sidebar 大列表保留 false |
| **B-06** | **评论区无 reply / 提交表单** — 只展示评论树，无发表评论的 UI；公开博客评论是单向输出 = 死功能 | `comments.tsx`, `[slug]/page.tsx:242-246` | 互动缺失 | 加 CommentForm（哪怕 admin-only/Cactus/Webmention 也要有入口） |
| **B-07** | **Featured image 用 `border` 不用 `border-radius`，但 `.reference-card` 用 `border-radius: 0.5rem`** — 两个相邻卡片元素圆角语言不统一 | `globals.css:787` vs `globals.css:1096` | token 不统一 | 统一选边：lizheng 偏硬边，把 reference-card 的 0.5rem 收掉（或用 `--radius-card` token） |
| **B-08** | **Comments 用 `border-l-2 border-blog-separator pl-4` 嵌套缩进** — 06 报告点名的"左 border 高亮卡片"反模式，且嵌套 3 层 ml-6 累计 72px，移动端横向溢出 | `comments.tsx:17` | 反模式 + 移动端布局 | 改为细分割线 + 头像缩进；mobile 最多嵌套 2 层 |
| **B-09** | **Pagination 激活态 `bg-blog-accent text-white` 蓝底白字** — 与全站除 footer 外的"扁平 + 端环 + 虚线"语言不符，admin Tailwind 风格漏到 blog | `pagination.tsx:41` | 设计语言串味 | 激活态用 mono + 下划线（lizheng 风），或参考 `.blog-read-more` 的 1px 渐进下划线 |
| **B-10** | **列表页 h1 三套字号不齐** — Search 页 `1.25em`，category/tag/archive 页 `text-2xl/md:text-3xl`，权重不一致 | `globals.css:1244-1249` vs `category/[slug]/page.tsx:74` 等 | 列表页 heading 无统一 | 抽 `<ListPageHeader>` 组件统一 h1 字号 + meta 排版 |
| **B-11** | **Tag pill hover 仅 `opacity: 0.8`** — 降低不透明度等于把对比度也打折，文字可读性下降，dark 主题尤甚（muted 色块上的 muted 文字） | `globals.css:766` | a11y / 微交互 | 改为加深 background 或 `color-mix` 提亮 fg，不要用 opacity |
| **B-12** | **空状态 `EmptyState` 无 CTA** — 只有图标 + "暂无文章。"，缺"返回首页/搜索"链接，404 / 空 tag / 空 category 走死胡同 | `empty-state.tsx`, 所有列表页 | 死路 | 给 EmptyState 加可选 `action?: { label, href }` slot |
| **B-13** | **`<Image fill sizes="...">` 同字符串拷贝 3 处** — `post-card.tsx:81`、`[slug]/page.tsx:205`、`preview/[id]/page.tsx:88` 均为 `(max-width: 900px) 100vw, min(75vw, 1000px)`，srcset 漂移风险 | 上述 3 文件 | 维护性 | 抽 `<FeaturedImage>` 组件 |
| **B-14** | **CommentItem 缺锚点 ID 和 permalink** — 访客无法"复制评论链接" | `comments.tsx:11-67` | 长尾可用性 | 给每条评论加 `<a href="#c-{id}">` 时间戳链接 |

### 1.3 P2 优化

| # | 问题 | 位置 | 修复方向 |
|---|------|------|----------|
| **B-15** | `prose-firefly` 没设置 `text-wrap: pretty/balance`，CJK 长标题尾行常出现孤字 | `globals.css:381-388` | h1/h2 加 `text-wrap: balance`，p 加 `text-wrap: pretty` |
| **B-16** | 行内 code padding 0.15em 0.35em 在 CJK 字间过紧；font-size 0.85em 在 1.0625rem 正文下 ≈14px 边缘 | `globals.css:395` | padding 提到 0.2em 0.4em，font-size 0.875em |
| **B-17** | `pre` 没有"复制按钮"和语言标识 — 技术博客标配缺失 | `globals.css:394`, `models/markdown.ts` | rehype-pretty-code transformerCopyButton 或自加 |
| **B-18** | Reference card 移动端竖排时图片 `min-height: 160px` 过高，OG 缩略图被拉伸模糊 | `globals.css:1176-1180` | 改 `aspect-ratio: 16/9` + `max-height: 200px` |
| **B-19** | Footer "回到顶部" 按钮 80 行 inline `style={{}}`，无法 hover | `blog-footer.tsx:48-77` | 抽到 `.zed-footer-back-to-top` class |
| **B-20** | `.blog-content img:not(a img) { cursor: pointer }` 让所有正文图看起来可点，但 lightbox 触发是 JS 委托 — 无键盘触发，无 `role="button" tabIndex={0}` | `globals.css:843`, `content-image-lightbox.tsx` | a11y | 给图片加 tabIndex/role 并监听 Enter/Space |
| **B-21** | 详情页 byline 顺序 `Author · Date · Category · Reading time · Edit`，列表 PostCard 是 `Date · Author` — 同信息块字段顺序不一致 | `[slug]/page.tsx:145-195` vs `post-card.tsx:43-71` | 统一顺序（author 优先或 date 优先） |
| **B-22** | `.zed-footer-cols` 仅 `grid-template-columns: 1fr auto auto` 3 列，与 23 报告"仿 zed 5 列"不符；COLUMNS 数组只配了 2 个 | `blog-footer.tsx:21-37`, `globals.css:914` | 补到 4-5 列，或调整 docs/23 reflect 实际现状 |
| **B-23** | `comments.tsx` 评论数 0 时直接 `return null`，评论区彻底消失 | `comments.tsx:76` | 改为"暂无评论" + form |
| **B-24** | `ArticleNav` 的 `H/J/K` 快捷键提示 `hidden sm:inline`，但快捷键本身 mobile 不可触发 — 提示反而展示给桌面用户而无 onboarding | `article-nav.tsx:140,153,170` | first-time 加 toast 或 footer 一行说明 |
| **B-25** | 噪点 `.blog-shell::after` 用 `mix-blend-mode: multiply / screen`，旧 Safari 上 z-index 与 sticky sidebar 叠加会闪烁 | `globals.css:434-446` | 加 `will-change: opacity` 或换静态 PNG |

---

## 2. Admin 后台审计

功能完善，但反馈链路与表单可恢复性偏弱，且 Input/Button primitives 形同虚设（被各处 raw className 复制盖过）。

### 2.1 P0 严重

| # | 问题 | 位置 | 影响 | 修复方向 |
|---|------|------|------|----------|
| **A-01** | **分页列表无省略号** — 所有页数全部渲染为按钮（`{ length: totalPages }.map`），数百篇文章时一长条按钮带，破坏布局且性能差 | `admin-posts-pagination.tsx:31` | 视觉灾难 + 不可用 | 实现 `1 ... 5 6 [7] 8 9 ... 42` 模式 + Prev/Next |
| **A-02** | **PostForm 错误提示无字段定位** — 保存失败把 API 原始 `error` 字符串塞到顶部红框，slug 冲突 / title 重复用户得猜哪个字段错 | `post-form.tsx:217-221, 191` | 写文章核心流程的可恢复性 | 改用字段内联错误 + toast 兜底；按 `error.field` 高亮对应输入框 |
| **A-03** | **MCP setup-guide 占据令牌页 ½ 屏** — `McpSetupGuide` 永久挂在 manager 顶部，老用户每次进来都要滚动跨过教程 | `mcp-tokens-manager.tsx:140` | 高频页面节奏被教程拖累 | 改为可折叠 / Dismiss + localStorage 记忆 |
| **A-04** | **批量操作完全没有删除** — `AdminPostsBulkActionBar` 只支持改状态/分类，没有批量删除；用户清理草稿需逐个删 | `admin-posts-bulk-action-bar.tsx:67-130` | 内容运营效率 | 加 destructive 按钮 + ConfirmDialog（输入数量确认） |

### 2.2 P1 中等

| # | 问题 | 位置 | 影响 | 修复方向 |
|---|------|------|------|----------|
| **A-05** | **Input className 复制 8+ 处** — `"w-full rounded-widget border border-border bg-secondary px-3 py-2..."` 被复制到 6 个组件，`Input` primitive 形同虚设 | `post-form.tsx:234,250`, `post-form-reference-fields.tsx:108`, `taxonomy-manager-form.tsx:37,44,52`, `post-form-content-editor.tsx:82,103`, `mcp-tokens-create-form.tsx:34` | 设计系统失守 | 全部改用 `<Input>` 和 `<Textarea>`（需新增） |
| **A-06** | **主按钮 raw className 至少 3 处** — `Button` primitive 已存在仍重复 | `post-form.tsx:305`, `admin-posts-client.tsx:163`, `taxonomy-manager.tsx:180` | 同 A-05 | 全部改为 `<Button>` |
| **A-07** | **空状态全部纯文本**（06 报告 C-12 已记，未修） — 10+ 处「暂无 X」用 `<p>` 渲染，无 icon、CTA、层级 | `media-library.tsx:191-200`, `admin-posts-list-view.tsx:208-213`, `admin-posts-grid-view.tsx:115-118`, `taxonomy-manager-table.tsx:156-161`, `mcp-tokens-manager.tsx:166-170` 等 | 节奏断点反馈薄弱 | 抽 `<EmptyState icon title description action>` primitive |
| **A-08** | **SystemMemoryCard 与 SystemMonitorDashboard 共享 fetch + 图表代码重复** — 两组件各自 `fetch("/api/system/memory")`、各自维护轮询/lastUpdated/loading state；图表都委托 `MemoryTrendChart`（`system-monitor-chart.tsx:20` 内做 downsample），但 fetch + UI 包装层（StatCard/Recommendation/Skeleton）在两处分别拼装 | `system-memory-card.tsx:69` 与 `system-monitor-dashboard.tsx:24-50, 116` | 维护负担、轮询双跑 | 抽 `useSystemMemory()` hook 统一 fetch + 轮询；包装出 `<MemoryPanel variant="compact" \| "full">` |
| **A-09** | **AnalyticsDashboard 第一屏中英混搭** — tab 标签中文，图例 `Human/Search/AI/Other` 英文 | `analytics-dashboard.tsx:29-34` 与 `traffic-trend.tsx:73-78` | i18n 一致性 | 统一为「人类/搜索/AI/其他」 |
| **A-10** | **post-form 保存按钮无 loading icon** — 只是文字变「保存中...」，而 `ai-agent-form.tsx:238` 已用 `<Loader2 animate-spin />` 形成不一致 | `post-form.tsx:307` | 反馈不一致 | 在 Button 内加 spinner |
| **A-11** | **Media library 上传无队列可视化** — 仅显示「上传中 3/10...」一行文本，单文件失败/重试无法定位 | `media-library.tsx:170-175` | 批量上传体验 | 加 per-file progress list |
| **A-12** | **TaxonomyManager 无内联校验** — slug 重复/格式错只在 submit 后从后端返回；用户输入空格也不提示 | `taxonomy-manager.tsx:81-121` | 表单可恢复性 | onBlur 校验 slug 正则 + 重复 |
| **A-13** | **AI 生成按钮用 emoji `✨` 当 icon** — 「✨ AI 生成」、「✨ AI 翻译」；其余 admin 100% 用 lucide-react，emoji 等宽渲染不一致 | `post-form-fields.tsx:60`, `post-form-reference-fields.tsx:140` | 视觉一致性 | 改用 `<Sparkles />` icon |
| **A-14** | **STATUS_COLORS 缺设计语义** — 状态徽标颜色硬编码在 `lib/status-colors.ts`，与 chart palette 不挂钩；published/draft/private/archived 与 chart-1/2 无关系 | 引用：`admin-posts-list-view.tsx:140` 等 | 主题色一致性 | 状态色映射到 success/warning/muted/info 等 semantic token |
| **A-15** | **CommandPalette 仅搜文章** — sidebar 提示「⌘K 搜索」但 palette 只走 `/api/admin/search?q=` 返回文章；用户搜「分类」「设置」「media」全 0 结果 | `command-palette.tsx:131-160, 256` | 期望落差大 | 加 navigation 命令组（页面跳转）+ 文章搜索分组 |

### 2.3 P2 优化

| # | 问题 | 位置 | 修复方向 |
|---|------|------|----------|
| **A-16** | image-upload-zone 用 emoji `📎` 当上传 icon，文案「📎 上传图片」混在文本里 | `image-upload-zone.tsx:151` | `<Paperclip />` 或 `<Upload />` |
| **A-17** | settings-form 复制按钮是 raw inline SVG（21 行 path），lucide-react 已装 | `settings-form.tsx:186-194` | `<Copy /> <Check /> <ExternalLink />` |
| **A-18** | site-identity-form 文本框 raw 长串（111 行）未用 `<Textarea>` | `site-identity-form.tsx:111` | 同 A-05 |
| **A-19** | sidebar 用户区无 hover/click — 只能通过 sign-out IconButton 退出 | `sidebar.tsx:331-358` | 后续可加 dropdown |
| **A-20** | analytics tab 切换无 sub-loading — 切到从未加载的 tab 仅显示 `TabSkeleton`，已加载切回去无 fresh-marker | `analytics-dashboard.tsx:201-205` | 加「数据时间」时间戳或 stale indicator |
| **A-21** | post-grid-card 选中态 `ring-2 ring-primary/20`，list-view 选中态 `bg-primary/5` — 两种语言 | `post-grid-card.tsx:46` vs `admin-posts-list-view.tsx:120` | 统一一种 |
| **A-22** | bulk-action-bar `sticky top-0` 在 ShellHeader 下方，scroll 后会被 header 覆盖（admin shell 已用 z-index 但 bar 也是 z-20） | `admin-posts-bulk-action-bar.tsx:67` | 测试 sticky offset + z-index 层级 |
| **A-23** | post-form publish-date 用浏览器原生 `datetime-local`，跨浏览器丑且不可主题化 | `post-form-fields.tsx:154-160` | 接入 react-day-picker 或同类 |
| **A-24** | ai-settings-form 「测试连接」按钮无成功/失败 icon — 成功仅蓝色文字，与错误同样 `text-sm` | `ai-settings-form.tsx:162-170` | `<CheckCircle2 />` / `<XCircle />` |
| **A-25** | post-filters 头部一行铺开 5 个 Select，移动端无优化 | `post-filters.tsx:56-141` | 折叠为「筛选」按钮 + popover |

---

## 3. 设计系统审计

### 3.1 P0 严重

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| **S-01** | **Token 双轨制无桥接** — `@theme inline` 的 `--color-blog-*` 别名虽建立（globals.css:69-76），但 UI primitives（button/card/input/select/badge）完全用 admin HSL token（`bg-secondary`, `text-foreground`）。在 blog 表面复用时颜色直接采用 admin 灰白，与 cream 调色板冲突 — 例：`AlertDialog` 用 `bg-background` 而不是 blog cream | `globals.css:69-76`, `ui/alert-dialog.tsx:33`, `ui/card.tsx:11` | 跨表面复用即破坏视觉一致性 |
| **S-03** | **`globals.css` 1259 行单文件、无模块化** — tokens、prose、layout shell、footer、reference card、search、recharts hack 全堆在一起；tag 调色板重复 4 份（root + dark + preview + preview-dark） | `globals.css` 整体；尤其 224-232/285-292/1035-1042/1054-1061 | 维护成本 + 回归风险 |

### 3.2 P1 中等

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| **S-04** | **暗色模式无 `color-scheme` 声明** — layout.tsx 仅 `theme-color` meta，未在 `:root`/`.dark` 设置 `color-scheme`。原生表单（`type="search"` 取消按钮、滚动条、autofill）在 dark 下仍显示 light UA 样式 | `globals.css:144-232/234-293`, `layout.tsx:113-115` | 原生控件色彩不一致 |
| **S-05** | **响应式断点裂为三套** — CSS `@media 768/769`、Tailwind `md/sm/2xl`、自定义 `--breakpoint-desktop:1200px`（从未引用）、reference-card 单独 640px。无统一定义 | `globals.css:91, 478, 526, 638, 993, 1172` | breakpoint drift |
| **S-06** | **图标体系混用** — `lucide-react`（61 文件）+ `icons/brand.tsx` 自绘 5 个 brand icon（lucide v1 已移除）+ `globals.css` 内嵌 SVG mask（grain + search-cancel）。strokeWidth 不统一（多数 1.5，部分用默认 2） | `brand.tsx`, `globals.css:440, 1235`, 散落各处 | 笔触粗细 / 视觉重量不一致 |
| **S-07** | **i18n 完全缺失** — 533 处中文在 admin、34 处在 blog 硬编码（含 `theme-toggle.tsx:36-53` 等 UI primitive 边缘）。无 dictionary、无 locale-toggle 实体（06 报告提到 `locale-toggle.tsx`，实际不存在）。`HTML_LANG = "zh-CN"` 单点写死 | `theme-toggle.tsx:36-53`, `blog-footer.tsx:23-37`, `lib/seo.ts:18` | 本地化 / 二次部署不可行 |
| **S-08** | **Print 样式只 1 行** — `@media print { .blog-shell::after { display: none; } }`，仅屏蔽 grain。未隐藏 sidebar/global-bar/zed-footer/cross-divider，未优化 prose 字号/分页 | `globals.css:446` | 打印体验缺失 |
| **S-09** | **`*:focus-visible` outline 用 admin token** — `outline: 2px solid hsl(var(--ring))` 是 admin 亮蓝（`217 91% 60%`），blog cream 表面上与 `--blog-accent`（深蓝 `oklch(48% 0.23 264)`）不一致。a11y OK，视觉错位 | `globals.css:334-337` | focus 视觉与表面 accent 失配 |
| **S-10** | **`blog-footer.tsx` 大量 inline style** — 26-72 行用 `style={{}}` 写 fontFamily/color/textDecoration（含 `rgba(255,255,255,0.78)` 硬编码），而 globals.css 已有 `.zed-footer-list a` 等同等样式 | `blog-footer.tsx:48-72` | CSS 双轨 / 无法主题化 |

### 3.3 P2 优化

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| **S-11** | **死代码 / 残留** — (a) `.blog-footer*` 标 "legacy — keep for back-compat" 但 grep 无任何 .tsx 引用；(b) `--breakpoint-desktop: 1200px` 未使用；(c) `var(--brand-hue, 240)` 全项目未定义，永远走 fallback | `globals.css:91, 736, 1004-1010` | 5-10 行死代码 |
| **S-12** | Tag 调色板 4 份重复（light/dark/preview-light/preview-dark），任何 token 变更需 4 处同步 | `globals.css:224/285/1035/1054` | DRY 违反 |
| **S-13** | `image-lightbox` / `alert-dialog` overlay 用 `bg-zinc-950/80` 硬编码，绕过 token | `image-lightbox.tsx:63,80,89`, `alert-dialog.tsx:16` | 暗色 overlay 对比度欠优 |
| **S-14** | `blog-preview-theme` 镜像 blog palette 但维护性差 — admin 内嵌博客预览必须复制全部 light/dark token，与 S-03 同源 | `globals.css:1017-1085` | 见 S-03 |
| **S-15** | **font preset 跨表面泄漏** — `[data-font-style]` 应用到 `<html>` 根，admin 也跟着切；当用户选 `serif`，admin 的统计数字会变衬线 | `layout.tsx:109`, `globals.css:110-115, 301-317` | 预期外 |
| **S-16** | **共享 primitives 缺失或重复** — `EmptyState` 只在 blog 抽出，admin 各处仍裸文本；`DataCard` 在 06 报告标完成实际查无独立文件；`ConfirmDialog` 与 `AlertDialog` primitive 重复 | `blog/empty-state.tsx`, `admin/confirm-dialog.tsx` | 复用边界未统一 |
| **S-17** | `theme-toggle` 三态语义不暴露 — `aria-label` 拼接当前态，但缺 `aria-pressed`/`role`；SSR placeholder 显示 Monitor 图标且 label 写死「跟随系统」，与服务端 cookie 持久化值可能不符 | `theme-toggle.tsx:43-47` | a11y / SSR 一致性 |
| **S-18** | `<noscript>` fallback 缺失 — theme-toggle、locale 切换、image-lightbox 关闭按钮、search keyboard hint 全 client-only | `layout.tsx` 整体 | 渐进增强缺失 |

---

## 4. 设计提升机会汇总

按"是否要做"和"工作量"两维度排列。

### 4.1 系统级（基础设施类）

1. **拆分 `globals.css`** — `@import` 分文件：tokens.css / prose.css / blog-shell.css / zed-footer.css / print.css。1259 行已超单文件维护阈值。**0.5 天**
2. **Token 桥层** — 把 blog tokens 也表达为 HSL，让 `bg-secondary`/`bg-card` 等 admin primitive 在 blog scope 下通过 `.blog-shell { --secondary: ...blog 等价值... }` 自动派生。S-01/S-13/S-14 同源解决。**1 天**
3. **加 `color-scheme` 声明** — 在 `:root` 加 `color-scheme: light` / `.dark { color-scheme: dark }`，让原生表单/滚动条/autofill 在暗色模式下渲染正确。**5 行内**
4. **统一断点** — `@theme inline` 定义 `--breakpoint-sm/md/lg/desktop`，CSS @media 通过 `theme(--breakpoint-md)` 引用，消灭 768/769/640/1200 magic numbers。**0.5 天**
5. **i18n 框架** — 抽 `lib/i18n/zh-CN.ts` dictionary，theme-toggle/blog-footer COLUMNS、admin PAGE_TITLES 迁出。先做 1 个 locale 也能解锁后续。**2 天**
6. **Print stylesheet** — `@media print` 隐藏 sidebar/global-bar/footer/divider/grain，将 prose font-size 调到 11pt，关闭 page-wrapper 装饰。**0.5 天**
7. **图标规范化** — 建立 `<Icon>` 包装统一 `size + strokeWidth=1.5`，或 `[data-lucide], svg.lucide { stroke-width: 1.5 }` 全局兜底。**0.5 天**
8. **死代码清扫** — 删 `.blog-footer*`、`--breakpoint-desktop`、`--brand-hue` 三处残留，清 06 已完成项的注释痕迹。**0.5 天**

### 4.2 共享 primitives 缺失（影响 P0/P1 半数问题）

9. **抽 4 个缺失 primitive**：`Textarea`、`EmptyState`（admin/blog 共用，带 action slot）、`SectionCard`（替代 `rounded-card bg-secondary p-5/6` 重复 7+ 处）、`FormField`（label + helper + input + error）。**1 天**
10. **`<FeaturedImage>` 组件** — 解 B-13，统一 `Image fill sizes` 字符串。**0.5 天**
11. **`<ListPageHeader>` 组件** — 解 B-10，统一 home/category/tag/archive/search 5 个列表页 h1+meta+breadcrumb。**0.5 天**

### 4.3 内容呈现升级（值得投资的设计资产）

12. **文章目录（TOC）sticky 右侧** — 长文 >1500 字时启用，936px 容器右侧有空间。lizheng/zed.dev 长文标配。**1 天**（rehype-slug + intersection observer）
13. **代码块增强** — copy 按钮 + 语言标签 + 行号 + 高亮某行（rehype-pretty-code）。技术博客核心输出，当前裸 pre 与 zed.dev 形成代差。**1 天**
14. **OG 图自动生成** — featured_image 为空时社交分享卡片半残；用 `@vercel/og` + 模板自动生成。**2 天**
15. **Reading progress 指示器** — 详情页顶部 1px 进度条。lizheng/medium/substack 标配。**0.5 天**
16. **Tag/Category 列表加迷你热力图** — archive 页加 commit-graph 风按月文章数热力。把"档案"从枯燥列表变成博客叙事。**1.5 天**
17. **暗色主题图片处理** — `.dark .blog-content img { filter: brightness(0.85) }` 或 prefers-color-scheme 媒体查询。**0.5 天**
18. **评论表单 + 锚点 permalink** — 解 B-06/B-14/B-23，建立单向 → 双向互动闭环。**1 天**

### 4.4 写作 / 管理流程的可恢复性

19. **保存失败的字段级反馈** — A-02 + A-12 + A-10 + A-11 都是同一类。引入"内联 field error + toast + 自动滚动到错误字段"三件套。**1 天**
20. **MCP 令牌页结构重排** — A-03 setup-guide 折到「帮助」icon popover；CommandPalette（A-15）升级成全局导航起点。**0.5 天**
21. **Dashboard 信息密度收敛** — 右栏 ContentStatCard (3) + OverviewCard (6) + SystemMemoryCard 三种卡片高度/字号/spacing 不一样，叠成 9 个不同节奏的卡片。OverviewCard 改 2 列网格（人类/独立、搜索/AI、其他/总浏览），ContentStatCard 收为一行 chip。**1 天**
22. **图表 palette 语义化** — A-14 + chart-helpers 已用 `--chart-N` 但缺「success/warning/error/info」语义层；加 `--chart-positive/--chart-negative/--chart-neutral`。**0.5 天**

---

## 5. 与 06 报告的对账

### 5.1 已修复（vs 06 报告）

- ✅ **C-01** radius tokens（`globals.css:83-88` 已落实 14/10/20/12/8/6 px）
- ✅ **C-03** Featured image 已用 `next/image`
- ✅ **C-04** sidebar `translateX(-670px)` magic number 已被新版 page-wrapper 几何替代
- ✅ **C-06** AnalyticsDashboard 骨架屏已实现（`AnalyticsSkeleton`/`LoadingSkeleton`）
- ✅ **C-07**（部分）Blog pagination 已实现页码 + 省略号（`pagination.tsx:36, buildPageSlots`）
- ✅ **C-08** ThemeToggle 与 blog 表面 hover 一致性（已用 `--blog-*`）
- ✅ Chart 颜色 token 化（`chart-helpers.ts:29-34` 用 `v("chart-N")`）
- ✅ `SegmentedControl`、`IconButton` 已抽出（`ui/`）
- ✅ Skip-to-content / focus-visible 全局已加（`globals.css:334-337`）

### 5.2 仍未修复（vs 06 报告）

- ❌ **C-02** Blog/admin 双色系统未真正打通 → 演变为 **S-01**（更精确：token 别名建立但 primitive 未对接）
- ❌ **C-07**（剩余）Admin pagination 仍缺省略号 → 对应 **A-01**
- ❌ **C-09** Featured image alt 仍只是 post title
- ❌ **C-12** StatCard/ChartCard/TableCard 重复 → 演变为 **A-08**（SystemMemoryCard 与 SystemMonitorDashboard 共享 fetch/轮询/UI 包装层重复；图表渲染都委托 `MemoryTrendChart`）
- ❌ **DataCard** 在 06 标完成项中实际查无文件（**S-16**）
- ❌ Empty state 仍纯文本（**A-07** + **B-12**）

---

## 6. 行动建议（建议落盘顺序）

### 6.1 第一波：1 天（致命体验 + 视觉污点）

A-02 列首 — 它是 P0 且改起来不大。其余按修复成本/可见度排序：

1. **A-02** PostForm 错误改字段级 `error.field` + 自动滚动（半天，含 API error 形状对齐）
2. **B-02** 404 给壳（30 min）
3. **A-01** 分页省略号（45 min）
4. **S-04** `color-scheme: light dark` 加（5 行）
5. **B-01** 社交链接渐变 → 纯品牌色（10 min）
6. **A-13 / A-16** emoji icon → lucide（30 min）
7. **B-04** dead `.blog-byline-author` 删/补（10 min）
8. **B-09** Pagination 激活态改 mono 下划线（20 min）
9. **S-11** 死代码清扫（30 min）

### 6.2 第二波：3 天 primitive 抽取（解决半数 P1）

抽 4 个 primitive：`Textarea`、`EmptyState`（含 action slot）、`SectionCard`、`FormField`，把 admin 的 8+ 处 raw className 全收回 primitive；blog 加 `<FeaturedImage>` 和 `<ListPageHeader>`。

### 6.3 第三波：5 天系统加固

- Token 桥层 + globals.css 拆分（**S-01/S-03**）
- print stylesheet（**S-08**）
- 写作流程的其他字段级反馈（**A-10/A-11/A-12**，承接 A-02 的字段错误链路）
- CommandPalette 升级为全局导航（**A-15**）
- i18n dictionary 抽出（**S-07**）

### 6.4 第四波：选做的设计资产

按 ROI 选 2-3 个：TOC + Reading progress + 代码块增强 + 评论表单 + OG 图自动生成。

---

**Review checklist（给 reviewer）**

- [ ] B-02 / A-01~A-04 P0 划分是否同意？特别 A-04 批量删除是否上线时刻意省掉
- [ ] B-01 / B-03 / B-04 / B-09 已下调到 P1 — 是否还有反对意见
- [ ] S-01 token 桥层方向 — 让 admin primitive 派生 vs 让 blog tokens 全表达 HSL，二选一
- [ ] 第一波 9 项 1 天的预估是否合理（A-02 占大头）
- [ ] i18n（S-07）目前是否在路线图上 — 影响后续设计决策的"是否值得抽 dictionary"

> 报告结束 · 共发现 25 (blog) + 25 (admin) + 17 (system, 删了 S-02 误报) = **67 项**改进点，22 条提升机会。

---

## Review 修订记录（2026-06-09）

针对 reviewer 提出的 5 条事实/严重度反馈：

| Review | 行动 | 验证 |
|--------|------|------|
| **S-02 事实错误**：`.dark` 已在 `globals.css:277` 定义 `--blog-text-secondary: #b3b8c2` | **删除 S-02**；摘要、第一波、计数全部移除该项 | `grep -n blog-text-secondary globals.css` → light:209、dark:277、引用:715/793/803 |
| **A-02 P0 但被推到第三波** | A-02 提到第一波 #1，第三波只保留 A-10/A-11/A-12 | — |
| **A-08 证据夸大**："600+ 行重复"不实，图表渲染委托给 `MemoryTrendChart` | 重写描述为"共享 fetch + 轮询 + UI 包装层重复"，修正位置和修复方向 | `system-monitor-dashboard.tsx:6,116`（委托 MemoryTrendChart）；downsample 在 `system-monitor-chart.tsx:20` |
| **B-01/B-03/B-04 P0 通胀** | 移到 P1（仅保留 B-02 在 Blog P0） | — |
| **B-13 计数不准** | 改为 3 处：`post-card.tsx:81`、`[slug]/page.tsx:205`、`preview/[id]/page.tsx:88`，全为同一字符串 | `grep 'sizes="(max-width' src/`（admin 的 grid/post-grid-card 是不同 sizes，不应计入） |

---

## 执行记录 — 第一波（2026-06-09 完成）

「6.1 第一波：1 天致命体验 + 视觉污点」全部 9 项已落盘，原子化提交 12 次，全部带 pre-commit（typecheck + lint + 1379 单测）；coverage 100% statements / 99.59% branches / 100% functions / 100% lines（门槛 95%）。

| 项 | 状态 | Commit | 改动摘要 |
|----|------|--------|----------|
| **S-04** | ✅ | `f491601` | `globals.css` :root + `.dark` 加 `color-scheme` 声明 |
| **B-01** | ✅ | `8a2a318` | 6 个社交 brand hover 从 135deg 渐变改为纯色填充，同时清理 `--brand-hue` 死引用 |
| **S-11** | ✅ | `bd3a04c` | 删除 `.blog-footer` legacy 类（grep 0 引用）+ `--breakpoint-desktop` 未使用 token |
| **B-04** | ✅ | `7dafc53` `f67078b` | `post-card.tsx:56` + `[slug]/page.tsx:146` 删除未定义的 `.blog-byline-author` 类 |
| **B-09** | ✅ | `55e6b47` | Blog pagination 激活态从 `bg-blog-accent text-white` 改为 mono + 下划线 |
| **A-13/A-16** | ✅ | `aacff21` | 3 处 emoji 图标（✨×2、📎）改 lucide `Sparkles`/`Paperclip`，加 `aria-hidden` |
| **B-02** | ✅ | `2c287fd` | `not-found.tsx` 从 60vh 居中文本改为 `.blog-shell` + `.page-wrapper` + `BlogFooter`，加最近 5 篇文章 + 首页/搜索入口 |
| **A-01** | ✅ | `e91e4c2` `e3f7590` `61a2823` | 抽 `lib/pagination.ts buildPageSlots`（6 个单测）；blog/admin pagination 共用，admin 加 prev/next + 省略号 |
| **A-02** | ✅ | `01ee740` `951eb81` | `inferErrorField` helper（5 个单测）+ PostForm 字段错误高亮 + ref 自动滚动 + aria-invalid |

### 验证

- `bun run typecheck` ✅
- `bun run lint` ✅
- `bunx vitest run` → 74 files / 1379 tests / 0 fail
- `bun run test:coverage` → 100% statements / 99.59% branches / 100% functions / 100% lines

### 计数变化

提交前 67 项、22 条机会。第一波闭合 9 项 → 剩 **58 项**未处理（Blog P1 11 + Blog P2 11 + Admin P1 10 + Admin P2 10 + System P1 7 + System P2 8 + 6 提升机会条目里的 polish/system 类待第二波 primitive 抽取）。

### 第一波之外的发现

- 抽 `buildPageSlots` 时顺手完成提升机会 #11 的一部分（共享 pagination 逻辑层），但 `<ListPageHeader>`/`<FeaturedImage>`/`Textarea`/`EmptyState`/`SectionCard`/`FormField` 仍未抽，留给第二波。
- A-02 现只覆盖 title/slug/content 三字段（API 当前只对这三处校验）；未来若新增 `category_id` 必填等校验，需扩展 `inferErrorField` 的 keyword 列表。
