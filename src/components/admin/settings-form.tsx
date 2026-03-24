"use client";

import { useState, useCallback } from "react";
import { useLocale } from "@/i18n/context";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { SiteSettings, FontStyle } from "@/data/settings";
import type { Locale } from "@/i18n/translations";

interface SettingsFormProps {
  settings: SiteSettings;
  logoUrl: string | null;
}

export function SettingsForm({ settings, logoUrl }: SettingsFormProps) {
  const { t } = useLocale();
  const [locale, setLocale] = useState<Locale>(settings.locale);
  const [postsPerPage, setPostsPerPage] = useState(String(settings.postsPerPage));
  const [commentsEnabled, setCommentsEnabled] = useState(settings.commentsEnabled);
  const [fontStyle, setFontStyle] = useState<FontStyle>(settings.fontStyle);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Logo state
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(logoUrl);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoRemoving, setLogoRemoving] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoDragOver, setLogoDragOver] = useState(false);

  const uploadLogo = useCallback(
    async (file: File) => {
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
          throw new Error(data.error ?? t("admin.upload.failed"));
        }

        const data = await res.json();
        // Find the 80px variant URL from the response
        const size80 = data.sizes?.find(
          (s: { size: number; url: string }) => s.size === 80,
        );
        if (size80) {
          setCurrentLogoUrl(size80.url);
        }
      } catch (err) {
        setLogoError(
          err instanceof Error ? err.message : t("admin.upload.failed"),
        );
      } finally {
        setLogoUploading(false);
      }
    },
    [t],
  );

  const removeLogo = useCallback(async () => {
    setLogoRemoving(true);
    setLogoError(null);

    try {
      const res = await fetch("/api/upload/logo", { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? t("admin.upload.failed"));
      }

      setCurrentLogoUrl(null);
    } catch (err) {
      setLogoError(
        err instanceof Error ? err.message : t("admin.upload.failed"),
      );
    } finally {
      setLogoRemoving(false);
    }
  }, [t]);

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadLogo(file);
    e.target.value = "";
  };

  const handleLogoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setLogoDragOver(false);
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
      {/* Site Logo */}
      <div className="space-y-2">
        <label className="text-base font-medium text-foreground">
          {t("admin.settings.siteLogo")}
        </label>
        <p className="text-sm text-muted-foreground">
          {t("admin.settings.siteLogoHint")}
        </p>

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
                  {logoUploading
                    ? t("admin.upload.uploading")
                    : t("admin.settings.siteLogoUpload")}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
                  onChange={handleLogoFileSelect}
                  disabled={logoUploading}
                  className="sr-only"
                />
              </label>
              {!logoUploading && (
                <span className="text-muted-foreground/60">
                  {t("admin.upload.dragDrop")}
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {t("admin.settings.siteLogoRequireSquare")}
            </p>

            {currentLogoUrl && (
              <button
                type="button"
                onClick={removeLogo}
                disabled={logoRemoving}
                className="self-start text-xs text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
              >
                {logoRemoving
                  ? t("admin.settings.saving")
                  : t("admin.settings.siteLogoRemove")}
              </button>
            )}
          </div>
        </div>

        {logoError && (
          <p className="text-xs text-destructive">{logoError}</p>
        )}
      </div>

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
