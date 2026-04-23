"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { SiteSettings, FontStyle } from "@/data/settings";

interface SettingsFormProps {
  settings: SiteSettings;
}

const internalUrls = [
  { label: "Sitemap", path: "/sitemap.xml" },
  { label: "Robots.txt", path: "/robots.txt" },
  { label: "RSS Feed", path: "/feed.xml" },
  { label: "LLMs.txt", path: "/llms.txt" },
];

export function SettingsForm({ settings }: SettingsFormProps) {
  const [postsPerPage, setPostsPerPage] = useState(String(settings.postsPerPage));
  const [commentsEnabled, setCommentsEnabled] = useState(settings.commentsEnabled);
  const [fontStyle, setFontStyle] = useState<FontStyle>(settings.fontStyle);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Copy-to-clipboard for internal URLs
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    return () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current); };
  }, []);

  const copyUrl = useCallback(async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopiedUrl(null), 800);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const n = Number(postsPerPage);
      if (Number.isNaN(n) || !Number.isInteger(n) || n < 1 || n > 100) {
        setMessage({ type: "error", text: "每页文章数必须为 1 到 100 之间的整数。" });
        setSaving(false);
        return;
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postsPerPage: n,
          commentsEnabled,
          fontStyle,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "保存设置失败。");
      }

      setMessage({ type: "success", text: "设置已保存。" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "保存设置失败。",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Card 1: Display Settings */}
      <div className="rounded-card bg-secondary p-5 md:p-6 space-y-5">
        <h2 className="text-base font-medium text-foreground">
          显示设置
        </h2>

        {/* Posts per page */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            每页文章数
          </label>
          <p className="text-xs text-muted-foreground">
            每页显示的文章数量（1–100）。
          </p>
          <Input
            type="number"
            min={1}
            max={100}
            value={postsPerPage}
            onChange={(e) => setPostsPerPage(e.target.value)}
            className="max-w-[120px]"
          />
        </div>

        {/* Font style */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            正文字体风格
          </label>
          <p className="text-xs text-muted-foreground">
            博客正文的排版风格。苹方：全苹方（默认）；经典：宋体正文 + 楷体标题；衬线：全宋体；无衬线：全黑体。
          </p>
          <SegmentedControl
            options={[
              { value: "pingfang", label: "苹方" },
              { value: "classic", label: "经典" },
              { value: "serif", label: "衬线" },
              { value: "sans", label: "无衬线" },
            ]}
            value={fontStyle}
            onChange={(v) => setFontStyle(v as FontStyle)}
          />
        </div>
      </div>

      {/* Card 2: Content Settings */}
      <div className="rounded-card bg-secondary p-5 md:p-6 space-y-5">
        <h2 className="text-base font-medium text-foreground">
          内容设置
        </h2>

        {/* Comments enabled */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            评论功能
          </label>
          <p className="text-xs text-muted-foreground">
            全局评论开关。关闭后所有文章的评论区都将隐藏。
          </p>
          <SegmentedControl
            options={[
              { value: "on", label: "开启" },
              { value: "off", label: "关闭" },
            ]}
            value={commentsEnabled ? "on" : "off"}
            onChange={(v) => setCommentsEnabled(v === "on")}
          />
        </div>
      </div>

      {/* Card 3: Internal URLs */}
      <div className="rounded-card bg-secondary p-5 md:p-6 space-y-4">
        <div>
          <h2 className="text-base font-medium text-foreground">
            内部功能链接
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            这些链接可用于提交搜索引擎或订阅 RSS。点击复制按钮快速复制。
          </p>
        </div>
        <div className="space-y-2">
          {internalUrls.map(({ label, path }) => {
            const fullUrl = `${origin}${path}`;
            const isCopied = copiedUrl === fullUrl;
            return (
              <div
                key={path}
                className="flex items-center gap-2 rounded-widget border border-border bg-secondary px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                  {fullUrl}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {label}
                </span>
                <button
                  type="button"
                  onClick={() => copyUrl(fullUrl)}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  title="复制链接"
                >
                  {isCopied ? (
                    <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                <a
                  href={fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status message */}
      {message && (
        <p
          className={`text-sm ${
            message.type === "success" ? "text-success" : "text-destructive"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Save button */}
      <Button
        type="button"
        disabled={saving}
        onClick={handleSave}
      >
        {saving ? "保存中..." : "保存设置"}
      </Button>
    </div>
  );
}
