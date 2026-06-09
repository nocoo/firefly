"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export interface ReferenceState {
  url: string;
  title: string;
  description: string;
  image: string;
}

interface PostReferenceFieldsProps {
  state: ReferenceState;
  hasFetched: boolean;
  onChange: (next: ReferenceState) => void;
  onHasFetchedChange: (next: boolean) => void;
}

/** Reference URL block: input + Fetch/Clear buttons + collapsible metadata editor. */
export function PostReferenceFields({
  state,
  hasFetched,
  onChange,
  onHasFetchedChange,
}: PostReferenceFieldsProps) {
  const [isUnfurling, setIsUnfurling] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [bodyText, setBodyText] = useState("");

  const handleUnfurl = async () => {
    if (!state.url.trim()) return;
    setIsUnfurling(true);
    try {
      const res = await fetch("/api/unfurl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: state.url.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "保存文章失败");
        return;
      }
      const data = await res.json();
      onChange({
        url: state.url,
        title: data.title ?? "",
        description: data.description ?? "",
        image: data.image ?? "",
      });
      setBodyText(data.bodyText ?? "");
      onHasFetchedChange(true);
    } catch {
      toast.error("保存文章失败");
    } finally {
      setIsUnfurling(false);
    }
  };

  const handleClear = () => {
    onChange({ url: "", title: "", description: "", image: "" });
    setBodyText("");
    onHasFetchedChange(false);
  };

  const handleEnhance = async () => {
    setIsEnhancing(true);
    try {
      const res = await fetch("/api/unfurl/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.title,
          description: state.description,
          bodyText,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "保存文章失败");
        return;
      }
      const data = await res.json();
      onChange({
        ...state,
        title: data.title || state.title,
        description: data.description || state.description,
      });
    } catch {
      toast.error("保存文章失败");
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        {"引用链接"}{" "}
        <span className="text-muted-foreground font-normal">{"（可选）"}</span>
      </label>
      <div className="flex gap-2">
        <Input
          type="url"
          value={state.url}
          onChange={(e) => onChange({ ...state, url: e.target.value })}
          className="flex-1"
          placeholder="https://github.com/..."
        />
        <button
          type="button"
          onClick={handleUnfurl}
          disabled={isUnfurling || !state.url.trim()}
          className="inline-flex items-center rounded-widget border border-border bg-secondary px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {isUnfurling ? "获取中..." : hasFetched ? "重新获取" : "获取"}
        </button>
        {(state.url || hasFetched) && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center rounded-widget border border-border bg-secondary px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            {"清除"}
          </button>
        )}
      </div>
      {hasFetched && (
        <div className="space-y-2 rounded-widget border border-border p-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">{"标题"}</label>
              <button
                type="button"
                onClick={handleEnhance}
                disabled={isEnhancing}
                className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
              >
                <Sparkles className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                {isEnhancing ? "翻译中..." : "AI 翻译"}
              </button>
            </div>
            <Input
              type="text"
              value={state.title}
              onChange={(e) => onChange({ ...state, title: e.target.value })}
              className="px-3 py-1.5"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">{"描述"}</label>
            <Textarea
              value={state.description}
              onChange={(e) =>
                onChange({ ...state, description: e.target.value })
              }
              rows={2}
              className="px-3 py-1.5"
            />
          </div>
          {state.image && (
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{"图片"}</label>
              <img
                src={state.image}
                alt={state.title || "Reference"}
                className="h-20 w-auto rounded object-cover"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
