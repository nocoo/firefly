"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nocoo/basalt/components/select";
import { Input } from "@/components/ui/input";

const EMPTY = "__empty__";
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
          value={sdkType === "" ? EMPTY : sdkType}
          onValueChange={(next) =>
            onSdkTypeChange(next === EMPTY ? "" : (next as SdkType))
          }
        >
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY}>Select protocol</SelectItem>
            <SelectItem value="anthropic">Anthropic</SelectItem>
            <SelectItem value="openai">OpenAI</SelectItem>
          </SelectContent>
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
          value={authType === "" ? EMPTY : authType}
          onValueChange={(next) =>
            onAuthTypeChange(next === EMPTY ? "" : (next as AuthType))
          }
        >
          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY}>Default (x-api-key / Bearer)</SelectItem>
            <SelectItem value="bearer">Force Bearer</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
