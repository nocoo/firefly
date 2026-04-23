# 23 — Blog 前端改版（lizheng.dev + zed.dev 混合设计语言）

## 目标
将公开 blog 页面的视觉风格对齐 `../lizheng.dev`（容器结构、装饰线/端点圆环、颗粒纹理、字体），并叠加 `https://zed.dev` 的"区段分隔 + 装饰网格 + 多列 footer"语言。

## 决策（已确认）
- 容器：page-wrapper 1500 / sidebar 320 / list 1180 / post 936
- Sidebar：top 极简（avatar/站名/tagline/社交），bottom 保留搜索/分类/标签云/归档
- 移动端 ≤768px：sidebar 顶部 stacked，移除 hamburger drawer
- Accent：lizheng 深蓝 `oklch(48% 0.23 264)`
- 字体：IBM Plex Sans/Mono/Serif + PingFang/Heti CJK fallback
- Featured image：砍掉 magazine bleed，严格落在 content 容器内
- 装饰密度：list 项之间用 hr + 节点；大版块切换用 cross-divider
- Footer：仿 zed 多列结构（站名/产品/资源/公司/社交）+ hatching 网格 + outline watermark

## 改造清单（原子化提交）

| # | 任务 | 状态 |
|---|------|------|
| 1 | globals.css：重写 token + 新增 7 个装饰 utility | ✅ |
| 2 | app/layout.tsx：注入 IBM Plex 字体 + 颗粒纹理层 | ✅ |
| 3 | (blog)/layout.tsx：包 .page-wrapper（1500 容器 + 边缘刻度尺） | ✅ |
| 4 | blog-layout-client.tsx：重排为 top-row/bottom-row + 移除 drawer | ✅ |
| 5 | blog-sidebar.tsx：拆 top-left / bottom-left + cross-divider | ✅ |
| 6 | post-card.tsx：砍 bleed | ✅ |
| 7 | blog-footer.tsx：仿 zed 5 列 + hatching + outline watermark | ✅ |
| 8 | dev server 视觉验收 | ✅ |
| 9 | 放大 site title（clamp 1.75–2.5rem） | ✅ |
| 10 | Footer 提升到 page-wrapper 之外，蓝色背景 100% 宽 | ✅ |
| 11 | 补全分割线 + 端点圆环（sidebar 段间 cross-divider；post entry 全宽线 + 端环） | ✅ |
| 12 | sidebar headings 字号 + 间距收敛（mono + 虚线下划线） | ✅ |

## 测试策略
覆盖率配置（`vitest.config.ts`）排除了 `src/components/**` 与 `src/app/**`，本轮改动均为视觉层（CSS + React 组件），不影响单元测试覆盖率门槛（90/90/90/90）。验收以 dev server 视觉走查为主。

## 提交记录
| Commit | 说明 |
|--------|------|
| `e6dd4b4` | rewrite globals.css palette + decorative utilities |
| `6d38c09` | inject IBM Plex fonts via next/font |
| `e22d920` | wrap blog routes in .page-wrapper |
| `36a7e69` | simplify layout client + restructure sidebar |
| `9767fa6` | tighten post-card title |
| `b9bf3cd` | rewrite footer as zed 5-column with hatching watermark |
| `<doc>`   | finalize tracking doc with status + commit log |
| `a64d8aa` | site title bigger, sidebar rhythm, full-bleed dividers |
| `8b732a4` | footer spans 100% viewport width |

## 验收
- typecheck pass、66 个测试文件 1279 用例全绿（每次 commit pre-commit 触发）
- dev server `bun run dev` (port 7028) 启动成功；GET /、/search、/feed.xml、/sitemap.xml 全 200
- coverage 不受影响（components/app 已在 vitest exclude 列表）
