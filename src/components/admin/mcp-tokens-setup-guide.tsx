"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Terminal } from "@nocoo/basalt/icons";

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
      className={`shrink-0 rounded-md p-1.5 text-basalt-muted-foreground hover:bg-basalt-accent hover:text-basalt-foreground transition-colors ${className ?? ""}`}
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
    <div className="group relative rounded-widget bg-basalt-secondary ring-1 ring-basalt-border/80 shadow-basalt-card">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-basalt-border">
        <span className="text-2xs font-medium uppercase tracking-wider text-basalt-muted-foreground">
          {lang ?? "config"}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-3 text-xs font-mono leading-relaxed text-basalt-foreground">
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
        <div className="rounded-lg bg-basalt-secondary p-2">
          <Terminal className="h-5 w-5 text-basalt-muted-foreground" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-basalt-foreground">配置指南</h3>
          <p className="mt-0.5 text-xs text-basalt-muted-foreground leading-relaxed">
            通过 Model Context Protocol 将 AI Agent 连接到博客。在下方创建令牌，然后将配置粘贴到客户端。
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-basalt-muted-foreground">
          MCP 端点
        </label>
        <div className="flex items-center gap-2 rounded-widget border border-basalt-border bg-basalt-secondary px-3 py-2">
          <code className="flex-1 text-xs font-mono text-basalt-foreground break-all">
            {mcpUrl}
          </code>
          <CopyButton text={mcpUrl} />
        </div>
      </div>

      <ol className="space-y-1 text-xs text-basalt-muted-foreground leading-relaxed list-decimal list-inside">
        <li>在下方创建令牌 — 名称与客户端对应（如 &quot;Claude Code&quot;）。</li>
        <li>复制令牌（仅显示一次），替换配置中的 YOUR_TOKEN。</li>
        <li>将配置粘贴到客户端的 MCP 设置文件中，然后重启客户端。</li>
      </ol>

      <div className="space-y-2">
        <div className="flex gap-1 rounded-lg bg-basalt-secondary/50 p-0.5 w-fit">
          {tabs.map(({ key, label }) => (
            <button type="button"
              key={key}
              onClick={() => setActiveTab(key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === key
                  ? "bg-basalt-secondary text-basalt-foreground shadow-sm"
                  : "text-basalt-muted-foreground hover:text-basalt-foreground"
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

      <p className="text-xs text-basalt-muted-foreground">
        16 个工具可用 — 文章（增删改查 + AI 摘要）、标签（增删改查）、分类（增删改查）。
      </p>
    </div>
  );
}
