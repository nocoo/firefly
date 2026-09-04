"use client";

import { useMemo, useState, useCallback, useDeferredValue } from "react";
import {
  Sun,
  Moon,
  Monitor,
  Smartphone,
  Globe,
  Share2,
  Copy,
  Check,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { renderMarkdown } from "@/models/markdown";
import { ArticleBody } from "@/components/blog/article-body";
import { ReferenceCard } from "@/components/blog/reference-card";
import {
  inlineWeChatHtml,
  buildWeChatStructure,
  copyWechatHtmlToClipboard,
  copyHtmlToClipboard,
  stripImagesFromHtml,
} from "@/lib/wechat";

export type DeviceMode = "desktop" | "mobile";
export type PlatformMode = "web" | "wechat";

interface MarkdownPreviewProps {
  title?: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  referenceUrl?: string;
  referenceTitle?: string;
  referenceDescription?: string;
  referenceImage?: string;
}

export function MarkdownPreview({
  title,
  excerpt,
  content,
  featuredImage,
  referenceUrl,
  referenceTitle,
  referenceDescription,
  referenceImage,
}: MarkdownPreviewProps) {
  // 1. Theme mode: light vs dark
  const { resolvedTheme } = useTheme();
  const [previewDark, setPreviewDark] = useState(resolvedTheme === "dark");
  const togglePreviewTheme = useCallback(() => setPreviewDark((d) => !d), []);

  // 2. Device mode: desktop vs mobile
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");

  // 3. Platform mode: web vs wechat
  const [platformMode, setPlatformMode] = useState<PlatformMode>("web");

  // Copy state feedback
  const [wechatCopied, setWechatCopied] = useState(false);
  const [webCopied, setWebCopied] = useState(false);

  // Markdown rendering
  const html = useMemo(
    () => (content ? renderMarkdown(content) : ""),
    [content],
  );

  // Deferred content for preview rendering to keep editor typing fluid
  const deferredHtml = useDeferredValue(html);
  const deferredTitle = useDeferredValue(title);
  const deferredExcerpt = useDeferredValue(excerpt);

  // WeChat preview HTML: use fast structural HTML + scoped CSS in preview,
  // avoiding synchronous heavy juice DOM parsing on every keystroke.
  const wechatPreviewHtml = useMemo(() => {
    if (platformMode !== "wechat") return "";
    const structured = buildWeChatStructure(deferredHtml, {
      title: deferredTitle,
      excerpt: deferredExcerpt,
      featuredImage,
      referenceUrl,
      referenceTitle,
      referenceDescription,
      referenceImage,
    });
    return `<section id="bm-md">${structured}</section>`;
  }, [
    platformMode,
    deferredHtml,
    deferredTitle,
    deferredExcerpt,
    featuredImage,
    referenceUrl,
    referenceTitle,
    referenceDescription,
    referenceImage,
  ]);

  const handleCopyWeChat = useCallback(async () => {
    // Generate full inlined CSS with juice only on demand when user copies
    const inlinedHtml = inlineWeChatHtml(html, {
      title,
      excerpt,
      featuredImage,
      referenceUrl,
      referenceTitle,
      referenceDescription,
      referenceImage,
    });

    const success = await copyWechatHtmlToClipboard(inlinedHtml);
    if (success) {
      setWechatCopied(true);
      toast.success("已复制微信公众号格式到剪贴板，可直接在微信编辑器粘贴");
      setTimeout(() => setWechatCopied(false), 2000);
    } else {
      toast.error("复制失败，请重试");
    }
  }, [
    html,
    title,
    excerpt,
    featuredImage,
    referenceUrl,
    referenceTitle,
    referenceDescription,
    referenceImage,
  ]);

  const handleCopyWebText = useCallback(async () => {
    if (!html) return;
    // Only copy body content, excluding title, excerpt, and images
    const textOnlyHtml = stripImagesFromHtml(html);
    const success = await copyHtmlToClipboard(textOnlyHtml);
    if (success) {
      setWebCopied(true);
      toast.success("已复制正文内容（不含标题、摘要及图片）");
      setTimeout(() => setWebCopied(false), 2000);
    } else {
      toast.error("复制失败，请重试");
    }
  }, [html]);

  const isEmpty =
    !title && !excerpt && !content && !featuredImage && !referenceUrl;

  return (
    <div className="flex h-full flex-col bg-muted/20">
      {/* Top Action / Mode Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 text-sm">
        {/* Left: Mode toggles */}
        <div className="flex items-center gap-1.5">
          {/* Group 1: Device (Desktop / Mobile) */}
          <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setDeviceMode("desktop")}
              aria-label="桌面视图"
              title="桌面视图"
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                deviceMode === "desktop"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>桌面</span>
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode("mobile")}
              aria-label="移动视图"
              title="移动视图"
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                deviceMode === "mobile"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>移动</span>
            </button>
          </div>

          {/* Group 2: Platform (Web / WeChat) */}
          <div className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setPlatformMode("web")}
              aria-label="网站模式"
              title="网站模式"
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                platformMode === "web"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>网站</span>
            </button>
            <button
              type="button"
              onClick={() => setPlatformMode("wechat")}
              aria-label="微信公众号模式"
              title="微信公众号模式"
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                platformMode === "wechat"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>公众号</span>
            </button>
          </div>
        </div>

        {/* Right: Actions (Copy format + Light/Dark toggle) */}
        <div className="flex items-center gap-1.5">
          {platformMode === "wechat" && (
            <button
              type="button"
              onClick={handleCopyWeChat}
              disabled={isEmpty}
              title="复制微信公众号排版到剪贴板（不含标题与摘要，含图片）"
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {wechatCopied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{wechatCopied ? "已复制" : "复制公众号格式"}</span>
            </button>
          )}

          {platformMode === "web" && (
            <button
              type="button"
              onClick={handleCopyWebText}
              disabled={!content}
              title="复制正文内容（不含标题、摘要及图片）"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {webCopied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{webCopied ? "已复制正文" : "复制正文"}</span>
            </button>
          )}

          {/* Group 3: Theme mode toggle */}
          <button
            type="button"
            onClick={togglePreviewTheme}
            aria-label={previewDark ? "切换为浅色" : "切换为深色"}
            title={previewDark ? "切换为浅色" : "切换为深色"}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {previewDark ? (
              <Sun className="h-3.5 w-3.5" strokeWidth={1.5} />
            ) : (
              <Moon className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="flex-1 overflow-y-auto p-4 flex justify-center">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center self-center">
            <p className="text-sm text-muted-foreground">
              开始编写以查看实时预览
            </p>
          </div>
        ) : (
          <div
            className={`w-full transition-all duration-200 ${
              deviceMode === "mobile"
                ? "max-w-[390px] shadow-lg rounded-2xl border border-border overflow-hidden my-auto"
                : "max-w-none"
            }`}
          >
            {platformMode === "web" ? (
              /* Web Mode Rendering */
              <div
                className={`blog-preview-theme ${
                  previewDark ? "blog-preview-dark dark" : ""
                } ${deviceMode === "mobile" ? "!min-h-[640px] px-5 py-6" : ""}`}
              >
                <ArticleBody
                  html={html}
                  referenceCard={
                    referenceUrl ? (
                      <ReferenceCard
                        url={referenceUrl}
                        title={referenceTitle}
                        description={referenceDescription}
                        image={referenceImage}
                      />
                    ) : undefined
                  }
                  header={
                    <>
                      {featuredImage && (
                        <div className="mb-8 overflow-hidden rounded-widget">
                          <img
                            src={featuredImage}
                            alt={title || "封面图片"}
                            className="w-full object-cover"
                          />
                        </div>
                      )}

                      {title && (
                        <h1 className="text-2xl font-bold leading-tight tracking-tight md:text-3xl">
                          {title}
                        </h1>
                      )}

                      {excerpt && (
                        <p className="mt-3 text-base leading-relaxed opacity-60">
                          {excerpt}
                        </p>
                      )}

                      {(title || excerpt) && content && (
                        <hr className="my-6 border-[var(--blog-separator)]" />
                      )}
                    </>
                  }
                />
              </div>
            ) : (
              /* WeChat Official Account Mode Rendering */
              <div
                className={`rounded-widget p-4 min-h-full ${
                  previewDark ? "wechat-preview-dark" : "bg-white"
                } ${deviceMode === "mobile" ? "!min-h-[640px] px-4 py-5" : ""}`}
              >
                <div dangerouslySetInnerHTML={{ __html: wechatPreviewHtml }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
