"use client";

import { CopyButton } from "./mcp-tokens-setup-guide";

/**
 * Show-once banner displayed after a new token is created so the user can copy
 * the raw access_token before it's hidden forever.
 */
export function McpNewTokenBanner({
  accessToken,
  onClose,
}: {
  accessToken: string;
  onClose: () => void;
}) {
  return (
    <div className="rounded-widget border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm">
      <p className="font-medium text-green-700 dark:text-green-400 mb-2">
        令牌创建成功！请立即复制 — 此后将无法再次查看。
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded bg-secondary px-2 py-1 text-xs font-mono break-all">
          {accessToken}
        </code>
        <CopyButton text={accessToken} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        此令牌仅显示一次，请安全保存。
      </p>
      <button
        onClick={onClose}
        className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
      >
        关闭
      </button>
    </div>
  );
}
