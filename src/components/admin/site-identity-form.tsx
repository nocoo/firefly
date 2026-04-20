"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { SiteSettings, SocialLink } from "@/data/settings";

const BRAND_OPTIONS = [
  { value: "github", label: "GitHub" },
  { value: "x", label: "X (Twitter)" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "email", label: "Email" },
  { value: "resume", label: "Resume" },
];

interface SiteIdentityFormProps {
  settings: SiteSettings;
  logoUrl: string | null;
}

export function SiteIdentityForm({ settings, logoUrl }: SiteIdentityFormProps) {
  // Identity state
  const [siteName, setSiteName] = useState(settings.siteName);
  const [siteTagline, setSiteTagline] = useState(settings.siteTagline);
  const [siteDescription, setSiteDescription] = useState(settings.siteDescription);
  const [siteAuthor, setSiteAuthor] = useState(settings.siteAuthor);
  const [authorEmail, setAuthorEmail] = useState(settings.authorEmail);
  const [twitterHandle, setTwitterHandle] = useState(settings.twitterHandle);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(settings.socialLinks);

  // Save state
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Logo state
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(logoUrl);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoRemoving, setLogoRemoving] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoDragOver, setLogoDragOver] = useState(false);
  const logoBusy = logoUploading || logoRemoving;

  const uploadLogo = useCallback(
    async (file: File) => {
      if (logoUploading || logoRemoving) return;
      setLogoUploading(true);
      setLogoError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload/logo", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "上传失败");
        }

        const data = await res.json();
        const size80 = data.sizes?.find(
          (s: { size: number; url: string }) => s.size === 80,
        );
        if (size80) {
          setCurrentLogoUrl(size80.url);
        }
      } catch (err) {
        setLogoError(
          err instanceof Error ? err.message : "上传失败",
        );
      } finally {
        setLogoUploading(false);
      }
    },
    [logoUploading, logoRemoving],
  );

  const removeLogo = useCallback(async () => {
    if (logoUploading || logoRemoving) return;
    setLogoRemoving(true);
    setLogoError(null);

    try {
      const res = await fetch("/api/upload/logo", { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "上传失败");
      }

      setCurrentLogoUrl(null);
    } catch (err) {
      setLogoError(
        err instanceof Error ? err.message : "上传失败",
      );
    } finally {
      setLogoRemoving(false);
    }
  }, [logoUploading, logoRemoving]);

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadLogo(file);
    e.target.value = "";
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setLogoDragOver(false);
    if (logoBusy) return;
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      uploadLogo(file);
    }
  };

  const handleLogoDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setLogoDragOver(true);
  };

  const handleLogoDragLeave = () => {
    setLogoDragOver(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName,
          siteTagline,
          siteDescription,
          siteAuthor,
          authorEmail,
          twitterHandle,
          socialLinks,
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
      {/* Card 1: Site Logo */}
      <div className="rounded-[var(--radius-card)] bg-secondary p-5 md:p-6 space-y-4">
        <div>
          <h2 className="text-base font-medium text-foreground">
            站点图标
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            上传一张正方形图片，将用作站点 favicon 和登录页头像。
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Logo preview */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
            {currentLogoUrl ? (
              <img
                src={currentLogoUrl}
                alt="Site logo"
                className="h-full w-full object-cover"
              />
            ) : (
              <svg
                className="h-8 w-8 text-muted-foreground/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            )}
          </div>

          {/* Upload / remove actions */}
          <div className="flex flex-col gap-2">
            <div
              onDrop={handleLogoDrop}
              onDragOver={handleLogoDragOver}
              onDragLeave={handleLogoDragLeave}
              className={`flex items-center gap-2 rounded-[var(--radius-widget)] border border-dashed px-3 py-2 text-xs transition-colors ${
                logoDragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground"
              }`}
            >
              <label className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                <span>
                  {logoUploading ? "上传中..." : "上传图标"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                  onChange={handleLogoFileSelect}
                  disabled={logoBusy}
                  className="sr-only"
                />
              </label>
              {!logoUploading && (
                <span className="text-muted-foreground/60">
                  或拖拽上传
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              图片必须为正方形（宽高相等）。
            </p>

            {currentLogoUrl && (
              <button
                type="button"
                onClick={removeLogo}
                disabled={logoBusy}
                className="self-start text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
              >
                {logoRemoving ? "保存中..." : "移除"}
              </button>
            )}
          </div>
        </div>

        {logoError && (
          <p className="text-xs text-destructive">{logoError}</p>
        )}
      </div>

      {/* Card 2: Site Info */}
      <div className="rounded-[var(--radius-card)] bg-secondary p-5 md:p-6 space-y-5">
        <h2 className="text-base font-medium text-foreground">
          站点信息
        </h2>

        {/* Site Name */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            站点名称
          </label>
          <p className="text-xs text-muted-foreground">
            博客名称，显示在标题栏、侧边栏和 Meta 标签中。
          </p>
          <Input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder="我的博客"
            maxLength={255}
            className="max-w-md"
          />
        </div>

        {/* Site Tagline */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            标语
          </label>
          <p className="text-xs text-muted-foreground">
            显示在侧边栏的简短座右铭或标语。
          </p>
          <Input
            value={siteTagline}
            onChange={(e) => setSiteTagline(e.target.value)}
            placeholder="一个关于……的个人博客"
            maxLength={500}
            className="max-w-md"
          />
        </div>

        {/* Site Description */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            站点描述
          </label>
          <p className="text-xs text-muted-foreground">
            用于 Meta Description 和 llms.txt。建议不超过几句话。
          </p>
          <textarea
            className="flex min-h-[80px] w-full max-w-lg rounded-md border border-border bg-secondary px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={siteDescription}
            onChange={(e) => setSiteDescription(e.target.value)}
            placeholder="一个关于技术、设计和生活的博客。"
            maxLength={1000}
            rows={3}
          />
        </div>
      </div>

      {/* Card 3: Author Info */}
      <div className="rounded-[var(--radius-card)] bg-secondary p-5 md:p-6 space-y-5">
        <h2 className="text-base font-medium text-foreground">
          作者信息
        </h2>

        {/* Author Name */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            作者名称
          </label>
          <p className="text-xs text-muted-foreground">
            文章和 RSS 订阅中显示的主要作者名称。
          </p>
          <Input
            value={siteAuthor}
            onChange={(e) => setSiteAuthor(e.target.value)}
            placeholder="张三"
            maxLength={255}
            className="max-w-md"
          />
        </div>

        {/* Author Email */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            作者邮箱
          </label>
          <p className="text-xs text-muted-foreground">
            用于 RSS 订阅的 managingEditor 字段。可选。
          </p>
          <Input
            type="email"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            placeholder="hello@example.com"
            maxLength={255}
            className="max-w-md"
          />
        </div>

        {/* Twitter Handle */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            Twitter/X 用户名
          </label>
          <p className="text-xs text-muted-foreground">
            用于 Twitter Card Meta 标签。无需 @ 前缀。
          </p>
          <div className="flex items-center gap-1 max-w-xs">
            <span className="text-sm text-muted-foreground">@</span>
            <Input
              value={twitterHandle}
              onChange={(e) => setTwitterHandle(e.target.value.replace(/^@/, ""))}
              placeholder="username"
              maxLength={50}
            />
          </div>
        </div>
      </div>

      {/* Card 4: Social Links */}
      <div className="rounded-[var(--radius-card)] bg-secondary p-5 md:p-6 space-y-4">
        <div>
          <h2 className="text-base font-medium text-foreground">
            社交链接
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            显示在博客侧边栏的链接。选择平台并输入 URL。
          </p>
        </div>

        <div className="space-y-3">
          {socialLinks.map((link, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <Select
                value={link.brand}
                onChange={(e) => {
                  const next = [...socialLinks];
                  next[idx] = { ...next[idx], brand: e.target.value };
                  setSocialLinks(next);
                }}
                className="w-32 shrink-0"
              >
                {BRAND_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
              <Input
                value={link.name}
                onChange={(e) => {
                  const next = [...socialLinks];
                  next[idx] = { ...next[idx], name: e.target.value };
                  setSocialLinks(next);
                }}
                placeholder="名称"
                className="w-28 shrink-0"
              />
              <Input
                value={link.url}
                onChange={(e) => {
                  const next = [...socialLinks];
                  next[idx] = { ...next[idx], url: e.target.value };
                  setSocialLinks(next);
                }}
                placeholder="链接"
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => setSocialLinks(socialLinks.filter((_, i) => i !== idx))}
                className="shrink-0 rounded px-2 py-2 text-xs text-destructive hover:text-destructive/80 transition-colors"
                title="移除"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setSocialLinks([...socialLinks, { name: "", url: "", brand: "github" }])
          }
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          + 添加链接
        </button>
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
