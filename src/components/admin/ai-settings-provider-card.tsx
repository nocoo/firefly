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
import type { AiProvider } from "@/services/ai";

export interface ProviderOption {
  id: AiProvider;
  label: string;
  models: string[];
  defaultModel: string;
}

export function AiSettingsProviderCard({
  providers,
  provider,
  model,
  onProviderChange,
  onModelChange,
}: {
  providers: ProviderOption[];
  provider: AiProvider | "";
  model: string;
  onProviderChange: (next: AiProvider | "") => void;
  onModelChange: (next: string) => void;
}) {
  const selectedProvider = providers.find((p) => p.id === provider);

  return (
    <div className="rounded-card bg-secondary p-5 md:p-6 space-y-5">
      <h2 className="text-base font-medium text-foreground">服务商 & 模型</h2>

      <div className="space-y-2">
        <label htmlFor="ai-provider" className="text-sm font-medium text-foreground">AI 服务商</label>
        <p className="text-xs text-muted-foreground">
          选择 AI 服务商。内置服务商会自动填充 URL 和协议。
        </p>
        <Select
          value={provider === "" ? EMPTY : provider}
          onValueChange={(next) =>
            onProviderChange(next === EMPTY ? "" : (next as AiProvider))
          }
        >
          <SelectTrigger id="ai-provider" className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY}>请选择服务商</SelectItem>
            {providers.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {provider && (
        <div className="space-y-2">
          <label htmlFor="ai-model" className="text-sm font-medium text-foreground">模型</label>
          <p className="text-xs text-muted-foreground">
            留空则使用服务商的默认模型。
            {selectedProvider?.defaultModel && (
              <> ({selectedProvider.defaultModel})</>
            )}
          </p>
          {selectedProvider && selectedProvider.models.length > 0 ? (
            <Select
              value={model === "" ? EMPTY : model}
              onValueChange={(next) => onModelChange(next === EMPTY ? "" : next)}
            >
              <SelectTrigger id="ai-model" className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EMPTY}>
                  {`${selectedProvider.defaultModel} (default)`}
                </SelectItem>
                {selectedProvider.models
                  .filter((m) => m !== selectedProvider.defaultModel)
                  .map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type="text"
              value={model}
              onChange={(e) => onModelChange(e.target.value)}
              placeholder="例如 claude-sonnet-4-20250514"
              className="max-w-sm"
            />
          )}
        </div>
      )}
    </div>
  );
}
