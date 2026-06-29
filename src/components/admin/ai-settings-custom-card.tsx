"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SdkType } from "@/services/ai";
import type { AuthType } from "@nocoo/next-ai";

export function AiSettingsCustomCard({
  baseURL,
  sdkType,
  authType,
  onBaseURLChange,
  onSdkTypeChange,
  onAuthTypeChange,
}: {
  baseURL: string;
  sdkType: SdkType | "";
  authType: AuthType | "";
  onBaseURLChange: (next: string) => void;
  onSdkTypeChange: (next: SdkType | "") => void;
  onAuthTypeChange: (next: AuthType | "") => void;
}) {
  return (
    <div className="rounded-card bg-secondary p-5 md:p-6 space-y-5">
      <h2 className="text-base font-medium text-foreground">自定义服务商</h2>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Base URL</label>
        <p className="text-xs text-muted-foreground">
          自定义服务商的 API 端点。
        </p>
        <Input
          type="url"
          value={baseURL}
          onChange={(e) => onBaseURLChange(e.target.value)}
          placeholder="https://api.example.com/v1"
          className="max-w-md"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">SDK 协议</label>
        <p className="text-xs text-muted-foreground">API 使用的协议类型。</p>
        <Select
          value={sdkType}
          onChange={(e) => onSdkTypeChange(e.target.value as SdkType | "")}
          className="max-w-xs"
        >
          <option value="">Select protocol</option>
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          认证头
        </label>
        <p className="text-xs text-muted-foreground">
          默认 Anthropic 协议使用 x-api-key；如果上游网关（如 manifest）只接受
          Authorization: Bearer，请选择 Force Bearer。
        </p>
        <Select
          value={authType}
          onChange={(e) =>
            onAuthTypeChange(e.target.value as AuthType | "")
          }
          className="max-w-xs"
        >
          <option value="">Default (x-api-key / Bearer)</option>
          <option value="bearer">Force Bearer</option>
        </Select>
      </div>
    </div>
  );
}
