"use client";

import { useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/admin/ai-agents-helpers";
import {
  buildAuthorProfileBrief,
  profileLookupPath,
} from "@/lib/author-profile-brief";

export interface ProfileLookupAuthor {
  name: string;
  email: string | null;
  hash: string | null;
  profilePublic: boolean;
}

export function AuthorProfileLookupDialog({
  author,
  siteUrl,
  onClose,
}: {
  author: ProfileLookupAuthor;
  siteUrl: string;
  onClose: () => void;
}) {
  const [trial, setTrial] = useState<{
    status: number;
    body: unknown;
  } | null>(null);
  const [trying, setTrying] = useState(false);
  const [tryError, setTryError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const brief = buildAuthorProfileBrief({
    name: author.name,
    email: author.email,
    hash: author.hash,
    profilePublic: author.profilePublic,
    siteUrl,
    trial,
  });

  const handleTry = async () => {
    if (!author.hash) return;
    setTrying(true);
    setTryError(null);
    try {
      const res = await fetch(profileLookupPath(author.hash));
      const body: unknown = await res.json().catch(() => null);
      setTrial({ status: res.status, body });
    } catch (error) {
      setTryError(error instanceof Error ? error.message : "请求失败");
    } finally {
      setTrying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-lookup-title"
        className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-background shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-border px-6 py-4">
          <h2
            id="profile-lookup-title"
            className="text-lg font-semibold text-foreground"
          >
            公开资料查询
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            用邮箱的 SHA-256 换取公开姓名和头像。整段可复制给其他
            agent 按同一份契约实现。
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                给其他 agent 的说明
              </label>
              <CopyButton text={brief} />
            </div>
            <pre className="mt-1 max-h-[280px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-secondary p-3 text-xs font-mono leading-relaxed text-foreground">
              {brief}
            </pre>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTry}
              disabled={!author.hash || trying}
            >
              {trying ? "请求中…" : "尝试请求"}
            </Button>
            {!author.hash && (
              <span className="text-xs text-muted-foreground">
                先给这位作者填邮箱才能试 hash 查询。
              </span>
            )}
            {author.hash && !author.profilePublic && (
              <span className="text-xs text-muted-foreground">
                未公开时接口会回空结果。
              </span>
            )}
          </div>

          {tryError && (
            <p className="text-sm text-destructive">{tryError}</p>
          )}
        </div>

        <div className="flex justify-end border-t border-border px-6 py-3">
          <Button variant="default" onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProfileLookupButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      title="公开资料查询"
    >
      <Hash className="h-4 w-4" />
    </button>
  );
}
