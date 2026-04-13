"use client";

import { useState } from "react";
import { useLocale } from "@/i18n/context";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { AiProvider, SdkType } from "@/services/ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderOption {
  id: AiProvider;
  label: string;
  models: string[];
  defaultModel: string;
}

interface AiSettingsFormProps {
  settings: {
    provider: AiProvider | "";
    apiKey: string; // masked
    hasApiKey: boolean;
    model: string;
    baseURL: string;
    sdkType: SdkType | "";
  };
  providers: ProviderOption[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiSettingsForm({ settings, providers }: AiSettingsFormProps) {
  const { t } = useLocale();
  const [provider, setProvider] = useState<AiProvider | "">(settings.provider);
  const [model, setModel] = useState(settings.model);
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState(settings.baseURL);
  const [sdkType, setSdkType] = useState<SdkType | "">(settings.sdkType);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isCustom = provider === "custom";
  const selectedProvider = providers.find((p) => p.id === provider);

  const handleProviderChange = (newProvider: AiProvider | "") => {
    setProvider(newProvider);
    // Reset model when switching providers
    setModel("");
    if (newProvider !== "custom") {
      setBaseURL("");
      setSdkType("");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const body: Record<string, string> = { provider };
      if (apiKey) body.apiKey = apiKey;
      if (model) body.model = model;
      if (isCustom) {
        body.baseURL = baseURL;
        body.sdkType = sdkType;
      }

      const res = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? t("admin.ai.saveFailed"));
      }

      setApiKey(""); // clear raw key input after save
      setMessage({ type: "success", text: t("admin.ai.saved") });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : t("admin.ai.saveFailed"),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!provider || (!settings.hasApiKey && !apiKey)) {
      setMessage({ type: "error", text: t("admin.ai.configureFirst") });
      return;
    }

    // Save first if there are unsaved changes
    if (apiKey || provider !== settings.provider || model !== settings.model) {
      await handleSave();
    }

    setTesting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/ai/test", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Test failed");
      }

      setMessage({
        type: "success",
        text: t("admin.ai.testSuccess", { model: data.model }),
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: t("admin.ai.testFailed", {
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Card 1: Provider & Model */}
      <div className="rounded-[var(--radius-card)] bg-secondary p-5 md:p-6 space-y-5">
        <h2 className="text-base font-medium text-foreground">
          {t("admin.ai.providerSection")}
        </h2>

        {/* Provider */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {t("admin.ai.provider")}
          </label>
          <p className="text-xs text-muted-foreground">
            {t("admin.ai.providerHint")}
          </p>
          <Select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as AiProvider | "")}
            className="max-w-xs"
          >
            <option value="">{t("admin.ai.providerPlaceholder")}</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Model */}
        {provider && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("admin.ai.model")}
            </label>
            <p className="text-xs text-muted-foreground">
              {t("admin.ai.modelHint")}
              {selectedProvider && selectedProvider.defaultModel && (
                <> ({selectedProvider.defaultModel})</>
              )}
            </p>
            {selectedProvider && selectedProvider.models.length > 0 ? (
              <Select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="max-w-sm"
              >
                <option value="">
                  {selectedProvider.defaultModel} (default)
                </option>
                {selectedProvider.models
                  .filter((m) => m !== selectedProvider.defaultModel)
                  .map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
              </Select>
            ) : (
              <Input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={t("admin.ai.modelPlaceholder")}
                className="max-w-sm"
              />
            )}
          </div>
        )}
      </div>

      {/* Card 2: Authentication */}
      {provider && (
        <div className="rounded-[var(--radius-card)] bg-secondary p-5 md:p-6 space-y-5">
          <h2 className="text-base font-medium text-foreground">
            {t("admin.ai.authSection")}
          </h2>

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("admin.ai.apiKey")}
            </label>
            <p className="text-xs text-muted-foreground">
              {t("admin.ai.apiKeyHint")}
            </p>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings.hasApiKey ? settings.apiKey : t("admin.ai.apiKeyPlaceholder")}
              className="max-w-md"
            />
          </div>
        </div>
      )}

      {/* Card 3: Custom Provider Settings */}
      {isCustom && (
        <div className="rounded-[var(--radius-card)] bg-secondary p-5 md:p-6 space-y-5">
          <h2 className="text-base font-medium text-foreground">
            {t("admin.ai.customSection")}
          </h2>

          {/* Base URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("admin.ai.baseURL")}
            </label>
            <p className="text-xs text-muted-foreground">
              {t("admin.ai.baseURLHint")}
            </p>
            <Input
              type="url"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder={t("admin.ai.baseURLPlaceholder")}
              className="max-w-md"
            />
          </div>

          {/* SDK Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("admin.ai.sdkType")}
            </label>
            <p className="text-xs text-muted-foreground">
              {t("admin.ai.sdkTypeHint")}
            </p>
            <Select
              value={sdkType}
              onChange={(e) => setSdkType(e.target.value as SdkType | "")}
              className="max-w-xs"
            >
              <option value="">Select protocol</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </Select>
          </div>
        </div>
      )}

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

      {/* Actions */}
      {provider && (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? t("admin.ai.saving") : t("admin.ai.save")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={testing || saving}
            onClick={handleTest}
          >
            {testing ? t("admin.ai.testing") : t("admin.ai.testConnection")}
          </Button>
        </div>
      )}
    </div>
  );
}
