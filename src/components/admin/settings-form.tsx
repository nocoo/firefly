"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/context";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { SiteSettings } from "@/data/settings";
import type { Locale } from "@/i18n/translations";

interface SettingsFormProps {
  settings: SiteSettings;
}

export function SettingsForm({ settings }: SettingsFormProps) {
  const { t } = useLocale();
  const [locale, setLocale] = useState<Locale>(settings.locale);
  const [postsPerPage, setPostsPerPage] = useState(String(settings.postsPerPage));
  const [commentsEnabled, setCommentsEnabled] = useState(settings.commentsEnabled);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
