"use client";

import { useState, useCallback } from "react";
import { useLocale } from "@/i18n/context";
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
  const { t } = useLocale();

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
          throw new Error(data.error ?? t("admin.upload.failed"));
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
    <div className="space-y-6">
      {/* Card 1: Site Logo */}
      <div className="rounded-[var(--radius-card)] bg-secondary p-5 md:p-6 space-y-4">
        <div>
          <h2 className="text-base font-medium text-foreground">
            {t("admin.settings.siteLogo")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("admin.settings.siteLogoHint")}
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

      {/* Card 2: Site Info */}
      <div className="rounded-[var(--radius-card)] bg-secondary p-5 md:p-6 space-y-5">
        <h2 className="text-base font-medium text-foreground">
          {t("admin.settings.siteInfoSection")}
        </h2>

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
            className="max-w-md"
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
            className="max-w-md"
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
            className="flex min-h-[80px] w-full max-w-lg rounded-md border border-border bg-secondary px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={siteDescription}
            onChange={(e) => setSiteDescription(e.target.value)}
            placeholder={t("admin.settings.siteDescriptionPlaceholder")}
            maxLength={1000}
            rows={3}
          />
        </div>
      </div>

      {/* Card 3: Author Info */}
      <div className="rounded-[var(--radius-card)] bg-secondary p-5 md:p-6 space-y-5">
        <h2 className="text-base font-medium text-foreground">
          {t("admin.settings.authorSection")}
        </h2>

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
            className="max-w-md"
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
            className="max-w-md"
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
          <div className="flex items-center gap-1 max-w-xs">
            <span className="text-sm text-muted-foreground">@</span>
            <Input
              value={twitterHandle}
              onChange={(e) => setTwitterHandle(e.target.value.replace(/^@/, ""))}
              placeholder={t("admin.settings.twitterHandlePlaceholder")}
              maxLength={50}
            />
          </div>
        </div>
      </div>

      {/* Card 4: Social Links */}
      <div className="rounded-[var(--radius-card)] bg-secondary p-5 md:p-6 space-y-4">
        <div>
          <h2 className="text-base font-medium text-foreground">
            {t("admin.settings.socialLinks")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("admin.settings.socialLinksHint")}
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
        </div>

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
        {saving ? t("admin.settings.saving") : t("admin.settings.save")}
      </Button>
    </div>
  );
}
