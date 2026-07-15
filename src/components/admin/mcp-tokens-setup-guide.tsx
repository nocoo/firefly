"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";

// ---------------------------------------------------------------------------
// Copy button (reusable across mcp-tokens views)
// ---------------------------------------------------------------------------

export function CopyButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button type="button"
      onClick={handleCopy}
      className={`shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors ${className ?? ""}`}
      title="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Code block with copy button
// ---------------------------------------------------------------------------

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="group relative rounded-widget bg-secondary border border-border">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <span className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
          {lang ?? "config"}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-3 text-xs font-mono leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Setup guide section
// ---------------------------------------------------------------------------

const PLACEHOLDER = "YOUR_TOKEN";

function buildClientConfig(mcpUrl: string): string {
  return `{
  "mcpServers": {
    "firefly": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${PLACEHOLDER}"
      }
    }
  }
}`;
}

function buildCliCommand(mcpUrl: string): string {
  return `curl -X POST ${mcpUrl} \\
  -H "Authorization: Bearer ${PLACEHOLDER}" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;
}

export function McpSetupGuide({ mcpUrl }: { mcpUrl: string }) {
  const [activeTab, setActiveTab] = useState<"claude" | "cursor" | "cli">(
    "claude",
  );

  const clientConfig = buildClientConfig(mcpUrl);
  const configs = {
    claude: clientConfig,
    cursor: clientConfig,
    cli: buildCliCommand(mcpUrl),
  };

  const tabs = [
    { key: "claude" as const, label: "Claude Code" },
    { key: "cursor" as const, label: "Cursor" },
    { key: "cli" as const, label: "cURL" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-secondary p-2">
          <Terminal className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">配置指南</h3>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            通过 Model Context Protocol 将 AI Agent 连接到博客。在下方创建令牌，然后将配置粘贴到客户端。
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          MCP 端点
        </label>
        <div className="flex items-center gap-2 rounded-widget border border-border bg-secondary px-3 py-2">
          <code className="flex-1 text-xs font-mono text-foreground break-all">
            {mcpUrl}
          </code>
          <CopyButton text={mcpUrl} />
        </div>
      </div>

      <ol className="space-y-1 text-xs text-muted-foreground leading-relaxed list-decimal list-inside">
        <li>在下方创建令牌 — 名称与客户端对应（如 &quot;Claude Code&quot;）。</li>
        <li>复制令牌（仅显示一次），替换配置中的 YOUR_TOKEN。</li>
        <li>将配置粘贴到客户端的 MCP 设置文件中，然后重启客户端。</li>
      </ol>

      <div className="space-y-2">
        <div className="flex gap-1 rounded-lg bg-secondary/50 p-0.5 w-fit">
          {tabs.map(({ key, label }) => (
            <button type="button"
              key={key}
              onClick={() => setActiveTab(key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === key
                  ? "bg-secondary text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <CodeBlock
          code={configs[activeTab]}
          lang={activeTab === "cli" ? "bash" : "json"}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        16 个工具可用 — 文章（增删改查 + AI 摘要）、标签（增删改查）、分类（增删改查）。
      </p>
    </div>
  );
}
