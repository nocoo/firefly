/**
 * Translation dictionary for `zh-CN` (default locale).
 *
 * Keys are dot-namespaced (`area.specific-string`) for groupability. The
 * shape is the single source of truth — every other locale must satisfy
 * `Dictionary` exactly (TS will enforce), so adding a key here makes the
 * compiler flag any missing translation.
 *
 * Only strings worth centralizing live here:
 *   - shared between admin + blog (theme toggle labels, etc.)
 *   - cited in multiple components (nav titles, common verbs)
 *   - likely to change wording in one place (footer headings, page subtitles)
 * One-off copy stays inline — overcollecting strings is its own anti-pattern.
 */

export const zhCN = {
  // theme-toggle (used in admin shell + blog global bar)
  "theme.toggle.label.system": "跟随系统",
  "theme.toggle.label.light": "浅色模式",
  "theme.toggle.label.dark": "深色模式",
  "theme.toggle.tip.next": "切换主题",

  // blog footer column headings
  "footer.column.content": "内容",
  "footer.column.resources": "资源",
  "footer.column.about": "关于",
  "footer.link.home": "首页",
  "footer.link.search": "搜索",
  "footer.link.rss": "订阅 RSS",
  "footer.link.archive": "归档",
  "footer.back-to-top": "回到顶部",

  // admin page titles / subtitles (canonical labels shown in header)
  "admin.page.dashboard": "概览",
  "admin.page.posts": "文章",
  "admin.page.media": "媒体库",
  "admin.page.categories": "分类",
  "admin.page.tags": "标签",
  "admin.page.site-identity": "站点身份",
  "admin.page.settings": "设置",
  "admin.page.ai-agents": "AI 代理",
  "admin.page.ai-settings": "AI 设置",
  "admin.page.mcp": "MCP 令牌",
  "admin.page.backup": "备份",
  "admin.page.system": "系统监控",
} as const;

export type TranslationKey = keyof typeof zhCN;
export type Dictionary = Record<TranslationKey, string>;

const DICTIONARIES: Record<string, Dictionary> = {
  "zh-CN": zhCN,
};

const DEFAULT_LOCALE = "zh-CN";

/**
 * Lookup a translation by key. Pure, synchronous, locale-pluggable later.
 *
 * Missing keys: returns the key string itself (e.g. `theme.toggle.label.dark`)
 * — visible in the UI, easy to spot in screenshots and review. We do not
 * silently substitute English or empty strings; that hides regressions.
 */
export function t(key: TranslationKey, locale: string = DEFAULT_LOCALE): string {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  return dict[key] ?? key;
}
