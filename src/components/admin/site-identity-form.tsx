"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { SiteSettings, SocialLink } from "@/data/settings";
import { SiteLogoCard } from "./site-logo-card";
import { SocialLinksCard } from "./social-links-card";

interface SiteIdentityFormProps {
  settings: SiteSettings;
  logoUrl: string | null;
}

export function SiteIdentityForm({ settings, logoUrl }: SiteIdentityFormProps) {
  const [siteName, setSiteName] = useState(settings.siteName);
  const [siteTagline, setSiteTagline] = useState(settings.siteTagline);
  const [siteDescription, setSiteDescription] = useState(
    settings.siteDescription,
  );
  const [siteAuthor, setSiteAuthor] = useState(settings.siteAuthor);
  const [authorEmail, setAuthorEmail] = useState(settings.authorEmail);
  const [twitterHandle, setTwitterHandle] = useState(settings.twitterHandle);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(
    settings.socialLinks,
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
      <SiteLogoCard initialLogoUrl={logoUrl} />

      {/* Card 2: Site Info */}
      <div className="rounded-card bg-secondary p-5 md:p-6 space-y-5">
        <h2 className="text-base font-medium text-foreground">站点信息</h2>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">站点名称</label>
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

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">标语</label>
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

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">站点描述</label>
          <p className="text-xs text-muted-foreground">
            用于 Meta Description 和 llms.txt。建议不超过几句话。
          </p>
          <Textarea
            className="max-w-lg"
            value={siteDescription}
            onChange={(e) => setSiteDescription(e.target.value)}
            placeholder="一个关于技术、设计和生活的博客。"
            maxLength={1000}
            rows={3}
          />
        </div>
      </div>

      {/* Card 3: Author Info */}
      <div className="rounded-card bg-secondary p-5 md:p-6 space-y-5">
        <h2 className="text-base font-medium text-foreground">作者信息</h2>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">作者名称</label>
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

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">作者邮箱</label>
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
              onChange={(e) =>
                setTwitterHandle(e.target.value.replace(/^@/, ""))
              }
              placeholder="username"
              maxLength={50}
            />
          </div>
        </div>
      </div>

      <SocialLinksCard socialLinks={socialLinks} onChange={setSocialLinks} />

      {message && (
        <p
          className={`text-sm ${
            message.type === "success" ? "text-success" : "text-destructive"
          }`}
        >
          {message.text}
        </p>
      )}

      <Button type="button" disabled={saving} onClick={handleSave}>
        {saving ? "保存中..." : "保存设置"}
      </Button>
    </div>
  );
}
