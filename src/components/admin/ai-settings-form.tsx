"use client";

import { useState } from "react";
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
        throw new Error(data.error ?? "保存 AI 设置失败。");
      }

      setApiKey(""); // clear raw key input after save
      setMessage({ type: "success", text: "AI 设置已保存。" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "保存 AI 设置失败。",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!provider || (!settings.hasApiKey && !apiKey)) {
      setMessage({ type: "error", text: "请先配置服务商和 API Key。" });
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
        text: `连接成功！模型：${data.model}`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: `连接失败：${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Card 1: Provider & Model */}
      <div className="rounded-card bg-secondary p-5 md:p-6 space-y-5">
        <h2 className="text-base font-medium text-foreground">
          服务商 & 模型
        </h2>

        {/* Provider */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            AI 服务商
          </label>
          <p className="text-xs text-muted-foreground">
            选择 AI 服务商。内置服务商会自动填充 URL 和协议。
          </p>
          <Select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as AiProvider | "")}
            className="max-w-xs"
          >
            <option value="">请选择服务商</option>
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
              模型
            </label>
            <p className="text-xs text-muted-foreground">
              留空则使用服务商的默认模型。
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
                placeholder="例如 claude-sonnet-4-20250514"
                className="max-w-sm"
              />
            )}
          </div>
        )}
      </div>

      {/* Card 2: Authentication */}
      {provider && (
        <div className="rounded-card bg-secondary p-5 md:p-6 space-y-5">
          <h2 className="text-base font-medium text-foreground">
            认证
          </h2>

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              API Key
            </label>
            <p className="text-xs text-muted-foreground">
              API 密钥将会安全存储。
            </p>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings.hasApiKey ? settings.apiKey : "sk-..."}
              className="max-w-md"
            />
          </div>
        </div>
      )}

      {/* Card 3: Custom Provider Settings */}
      {isCustom && (
        <div className="rounded-card bg-secondary p-5 md:p-6 space-y-5">
          <h2 className="text-base font-medium text-foreground">
            自定义服务商
          </h2>

          {/* Base URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Base URL
            </label>
            <p className="text-xs text-muted-foreground">
              自定义服务商的 API 端点。
            </p>
            <Input
              type="url"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="max-w-md"
            />
          </div>

          {/* SDK Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              SDK 协议
            </label>
            <p className="text-xs text-muted-foreground">
              API 使用的协议类型。
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
            {saving ? "保存中..." : "保存设置"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={testing || saving}
            onClick={handleTest}
          >
            {testing ? "测试中..." : "测试连接"}
          </Button>
        </div>
      )}
    </div>
  );
}
