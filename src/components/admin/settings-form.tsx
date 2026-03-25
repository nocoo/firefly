"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useLocale } from "@/i18n/context";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { SiteSettings, FontStyle } from "@/data/settings";
import type { Locale } from "@/i18n/translations";

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
  const { t } = useLocale();
  const [locale, setLocale] = useState<Locale>(settings.locale);
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
        setMessage({ type: "error", text: t("admin.settings.invalidPostsPerPage") });
        setSaving(false);
        return;
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          postsPerPage: n,
          commentsEnabled,
          fontStyle,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? t("admin.settings.saveFailed"));
      }

      setMessage({ type: "success", text: t("admin.settings.saved") });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : t("admin.settings.saveFailed"),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-8">
      {/* Locale */}
      <div className="space-y-2">
        <label className="text-base font-medium text-foreground">
          {t("admin.settings.locale")}
        </label>
        <p className="text-sm text-muted-foreground">
          {t("admin.settings.localeHint")}
        </p>
        <Select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
        >
          <option value="zh">中文</option>
          <option value="en">English</option>
        </Select>
      </div>

      {/* Posts per page */}
      <div className="space-y-2">
        <label className="text-base font-medium text-foreground">
          {t("admin.settings.postsPerPage")}
        </label>
        <p className="text-sm text-muted-foreground">
          {t("admin.settings.postsPerPageHint")}
        </p>
        <Input
          type="number"
          min={1}
          max={100}
          value={postsPerPage}
          onChange={(e) => setPostsPerPage(e.target.value)}
        />
      </div>

      {/* Comments enabled */}
      <div className="space-y-2">
        <label className="text-base font-medium text-foreground">
          {t("admin.settings.commentsEnabled")}
        </label>
        <p className="text-sm text-muted-foreground">
          {t("admin.settings.commentsEnabledHint")}
        </p>
        <SegmentedControl
          options={[
            { value: "on", label: t("admin.settings.commentsOn") },
            { value: "off", label: t("admin.settings.commentsOff") },
          ]}
          value={commentsEnabled ? "on" : "off"}
          onChange={(v) => setCommentsEnabled(v === "on")}
        />
      </div>

      {/* Font style */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          {t("admin.settings.fontStyle")}
        </label>
        <p className="text-xs text-muted-foreground">
          {t("admin.settings.fontStyleHint")}
        </p>
        <SegmentedControl
          options={[
            { value: "pingfang", label: t("admin.settings.fontStylePingfang") },
            { value: "classic", label: t("admin.settings.fontStyleClassic") },
            { value: "serif", label: t("admin.settings.fontStyleSerif") },
            { value: "sans", label: t("admin.settings.fontStyleSans") },
          ]}
          value={fontStyle}
          onChange={(v) => setFontStyle(v as FontStyle)}
        />
      </div>

      {/* Internal URLs */}
      <div className="space-y-2">
        <label className="text-base font-medium text-foreground">
          {t("admin.settings.internalUrls")}
        </label>
        <p className="text-sm text-muted-foreground">
          {t("admin.settings.internalUrlsHint")}
        </p>
        <div className="space-y-1.5">
          {internalUrls.map(({ label, path }) => {
            const fullUrl = `${origin}${path}`;
            const isCopied = copiedUrl === fullUrl;
            return (
              <div
                key={path}
                className="flex items-center gap-2 rounded-[var(--radius-widget)] border border-border px-3 py-2"
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
                  title={t("admin.upload.copyUrl")}
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
            message.type === "success" ? "text-green-600" : "text-destructive"
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
        {saving ? t("admin.settings.saving") : t("admin.settings.save")}
      </Button>
    </div>
  );
}
