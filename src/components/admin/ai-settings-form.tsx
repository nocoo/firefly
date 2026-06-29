"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AiProvider, SdkType } from "@/services/ai";
import type { AuthType } from "@nocoo/next-ai";
import {
  AiSettingsProviderCard,
  type ProviderOption,
} from "./ai-settings-provider-card";
import { AiSettingsCustomCard } from "./ai-settings-custom-card";

interface AiSettingsFormProps {
  settings: {
    provider: AiProvider | "";
    apiKey: string; // masked
    hasApiKey: boolean;
    model: string;
    baseURL: string;
    sdkType: SdkType | "";
    authType: AuthType | "";
  };
  providers: ProviderOption[];
}

type Message = { type: "success" | "error"; text: string };

export function AiSettingsForm({ settings, providers }: AiSettingsFormProps) {
  const [provider, setProvider] = useState<AiProvider | "">(settings.provider);
  const [model, setModel] = useState(settings.model);
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState(settings.baseURL);
  const [sdkType, setSdkType] = useState<SdkType | "">(settings.sdkType);
  const [authType, setAuthType] = useState<AuthType | "">(settings.authType);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const isCustom = provider === "custom";

  const handleProviderChange = (newProvider: AiProvider | "") => {
    setProvider(newProvider);
    // Reset model when switching providers
    setModel("");
    if (newProvider !== "custom") {
      setBaseURL("");
      setSdkType("");
      setAuthType("");
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
        body.authType = authType;
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
      const raw = await res.text();
      let data: { error?: string; model?: string } = {};
      try {
        data = JSON.parse(raw);
      } catch {
        // Edge / gateway returned non-JSON (HTML error page). Fall through
        // with raw text — first 200 chars is plenty for diagnostics.
        if (!res.ok) {
          throw new Error(
            `服务器返回 HTTP ${res.status}：${raw.slice(0, 200).trim() || "无内容"}`,
          );
        }
      }

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
      <AiSettingsProviderCard
        providers={providers}
        provider={provider}
        model={model}
        onProviderChange={handleProviderChange}
        onModelChange={setModel}
      />

      {provider && (
        <div className="rounded-card bg-secondary p-5 md:p-6 space-y-5">
          <h2 className="text-base font-medium text-foreground">认证</h2>
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

      {isCustom && (
        <AiSettingsCustomCard
          baseURL={baseURL}
          sdkType={sdkType}
          authType={authType}
          onBaseURLChange={setBaseURL}
          onSdkTypeChange={setSdkType}
          onAuthTypeChange={setAuthType}
        />
      )}

      {message && (
        <p
          className={`text-sm ${
            message.type === "success" ? "text-success" : "text-destructive"
          }`}
        >
          {message.text}
        </p>
      )}

      {provider && (
        <div className="flex items-center gap-3">
          <Button type="button" disabled={saving} onClick={handleSave}>
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
