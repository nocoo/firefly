"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useLocale } from "@/i18n/context";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { SiteSettings, FontStyle, SocialLink } from "@/data/settings";
import type { Locale } from "@/i18n/translations";

const BRAND_OPTIONS = [
  { value: "github", label: "GitHub" },
  { value: "x", label: "X (Twitter)" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "email", label: "Email" },
  { value: "resume", label: "Resume" },
];

interface SettingsFormProps {
  settings: SiteSettings;
  logoUrl: string | null;
}

const internalUrls = [
  { label: "Sitemap", path: "/sitemap.xml" },
  { label: "Robots.txt", path: "/robots.txt" },
  { label: "RSS Feed", path: "/feed.xml" },
  { label: "LLMs.txt", path: "/llms.txt" },
];

export function SettingsForm({ settings, logoUrl }: SettingsFormProps) {
  const { t } = useLocale();
  const [locale, setLocale] = useState<Locale>(settings.locale);
  const [postsPerPage, setPostsPerPage] = useState(String(settings.postsPerPage));
  const [commentsEnabled, setCommentsEnabled] = useState(settings.commentsEnabled);
  const [fontStyle, setFontStyle] = useState<FontStyle>(settings.fontStyle);
  const [siteName, setSiteName] = useState(settings.siteName);
  const [siteTagline, setSiteTagline] = useState(settings.siteTagline);
  const [siteDescription, setSiteDescription] = useState(settings.siteDescription);
  const [siteAuthor, setSiteAuthor] = useState(settings.siteAuthor);
  const [authorEmail, setAuthorEmail] = useState(settings.authorEmail);
  const [twitterHandle, setTwitterHandle] = useState(settings.twitterHandle);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(settings.socialLinks);
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
    [t, logoUploading, logoRemoving],
  );

  const removeLogo = useCallback(async () => {
    if (logoUploading || logoRemoving) return;
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
  }, [t, logoUploading, logoRemoving]);

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
                  disabled={logoBusy}
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
                disabled={logoBusy}
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

      {/* Site Identity */}
      <fieldset className="space-y-6 rounded-lg border border-border p-4">
        <legend className="px-2 text-base font-semibold text-foreground">
          {t("admin.settings.siteIdentity")}
        </legend>

        {/* Site Name */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {t("admin.settings.siteName")}
          </label>
          <p className="text-xs text-muted-foreground">
            {t("admin.settings.siteNameHint")}
          </p>
          <Input
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder={t("admin.settings.siteNamePlaceholder")}
            maxLength={255}
          />
        </div>

        {/* Site Tagline */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {t("admin.settings.siteTagline")}
          </label>
          <p className="text-xs text-muted-foreground">
            {t("admin.settings.siteTaglineHint")}
          </p>
          <Input
            value={siteTagline}
            onChange={(e) => setSiteTagline(e.target.value)}
            placeholder={t("admin.settings.siteTaglinePlaceholder")}
            maxLength={500}
          />
        </div>

        {/* Site Description */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {t("admin.settings.siteDescription")}
          </label>
          <p className="text-xs text-muted-foreground">
            {t("admin.settings.siteDescriptionHint")}
          </p>
          <textarea
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={siteDescription}
            onChange={(e) => setSiteDescription(e.target.value)}
            placeholder={t("admin.settings.siteDescriptionPlaceholder")}
            maxLength={1000}
            rows={3}
          />
        </div>

        {/* Author Name */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {t("admin.settings.siteAuthor")}
          </label>
          <p className="text-xs text-muted-foreground">
            {t("admin.settings.siteAuthorHint")}
          </p>
          <Input
            value={siteAuthor}
            onChange={(e) => setSiteAuthor(e.target.value)}
            placeholder={t("admin.settings.siteAuthorPlaceholder")}
            maxLength={255}
          />
        </div>

        {/* Author Email */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {t("admin.settings.authorEmail")}
          </label>
          <p className="text-xs text-muted-foreground">
            {t("admin.settings.authorEmailHint")}
          </p>
          <Input
            type="email"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            placeholder={t("admin.settings.authorEmailPlaceholder")}
            maxLength={255}
          />
        </div>

        {/* Twitter Handle */}
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            {t("admin.settings.twitterHandle")}
          </label>
          <p className="text-xs text-muted-foreground">
            {t("admin.settings.twitterHandleHint")}
          </p>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">@</span>
            <Input
              value={twitterHandle}
              onChange={(e) => setTwitterHandle(e.target.value.replace(/^@/, ""))}
              placeholder={t("admin.settings.twitterHandlePlaceholder")}
              maxLength={50}
            />
          </div>
        </div>

        {/* Social Links */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("admin.settings.socialLinks")}
          </label>
          <p className="text-xs text-muted-foreground">
            {t("admin.settings.socialLinksHint")}
          </p>

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
                placeholder={t("admin.settings.socialLinkName")}
                className="w-28 shrink-0"
              />
              <Input
                value={link.url}
                onChange={(e) => {
                  const next = [...socialLinks];
                  next[idx] = { ...next[idx], url: e.target.value };
                  setSocialLinks(next);
                }}
                placeholder={t("admin.settings.socialLinkUrl")}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => setSocialLinks(socialLinks.filter((_, i) => i !== idx))}
                className="shrink-0 rounded px-2 py-2 text-xs text-destructive hover:text-destructive/80 transition-colors"
                title={t("admin.settings.socialLinkRemove")}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setSocialLinks([...socialLinks, { name: "", url: "", brand: "github" }])
            }
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            + {t("admin.settings.socialLinkAdd")}
          </button>
        </div>
      </fieldset>

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
