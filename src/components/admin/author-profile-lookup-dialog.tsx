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

async function fetchProfileTrial(hash: string): Promise<{
  status: number;
  body: unknown;
}> {
  const res = await fetch(profileLookupPath(hash));
  const body: unknown = await res.json().catch(() => null);
  return { status: res.status, body };
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
  });

  const runTrial = async (hash: string) => {
    setTrying(true);
    setTryError(null);
    try {
      setTrial(await fetchProfileTrial(hash));
    } catch (error) {
      setTrial(null);
      setTryError(error instanceof Error ? error.message : "请求失败");
    } finally {
      setTrying(false);
    }
  };

  useEffect(() => {
    if (!author.hash) return;
    let cancelled = false;
    setTrying(true);
    setTryError(null);
    void fetchProfileTrial(author.hash)
      .then((result) => {
        if (!cancelled) setTrial(result);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setTrial(null);
        setTryError(error instanceof Error ? error.message : "请求失败");
      })
      .finally(() => {
        if (!cancelled) setTrying(false);
      });
    return () => {
      cancelled = true;
    };
  }, [author.hash]);

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
            用邮箱的 SHA-256 调用接口，换取公开姓名和头像。
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                说明
              </label>
              <CopyButton text={brief} />
            </div>
            <pre className="mt-1 max-h-[240px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-secondary p-3 text-xs font-mono leading-relaxed text-foreground">
              {brief}
            </pre>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                测试调用
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (author.hash) void runTrial(author.hash);
                }}
                disabled={!author.hash || trying}
              >
                {trying ? "请求中…" : trial ? "再试一次" : "尝试请求"}
              </Button>
              {!author.hash && (
                <span className="text-xs text-muted-foreground">
                  先给这位作者填邮箱才能试。
                </span>
              )}
              {author.hash && !author.profilePublic && (
                <span className="text-xs text-muted-foreground">
                  未公开时会返回空结果。
                </span>
              )}
            </div>

            {tryError && (
              <p className="text-sm text-destructive">{tryError}</p>
            )}

            {trial && (
              <div className="rounded-md border border-border bg-secondary">
                <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    HTTP {trial.status}
                  </span>
                  <CopyButton text={JSON.stringify(trial.body, null, 2)} />
                </div>
                <pre className="max-h-[200px] overflow-auto p-3 text-xs font-mono leading-relaxed text-foreground whitespace-pre-wrap">
                  {JSON.stringify(trial.body, null, 2)}
                </pre>
              </div>
            )}
          </div>
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
