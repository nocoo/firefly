"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SdkType } from "@/services/ai";

export function AiSettingsCustomCard({
  baseURL,
  sdkType,
  onBaseURLChange,
  onSdkTypeChange,
}: {
  baseURL: string;
  sdkType: SdkType | "";
  onBaseURLChange: (next: string) => void;
  onSdkTypeChange: (next: SdkType | "") => void;
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
    </div>
  );
}
