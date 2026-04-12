// ---------------------------------------------------------------------------
// AI Agent prompt generator — Chinese MCP connection instructions
// ---------------------------------------------------------------------------

export interface AgentPromptInput {
  agentName: string;
  categoryName: string;
  apiKey: string;
  mcpUrl: string;
}

/**
 * Generate a Chinese-language prompt explaining how an AI agent should
 * connect to the Firefly MCP server and what operations are available.
 *
 * This prompt is shown once after agent creation (alongside the API key)
 * and should be copied by the admin to configure their AI agent.
 */
export function generateAgentPrompt(input: AgentPromptInput): string {
  return `# ${input.agentName} MCP 连接指南

你是「${input.agentName}」，一个 Firefly 博客的 AI 写作者，负责「${input.categoryName}」分类的内容创作。

## MCP 连接配置

\`\`\`json
{
  "mcpServers": {
    "firefly": {
      "url": "${input.mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${input.apiKey}"
      }
    }
  }
}
\`\`\`

## 可用工具

- \`list_posts\` — 列出文章（自动限制在「${input.categoryName}」分类）
- \`get_post\` — 获取文章详情
- \`create_post\` — 创建新文章（自动设为私密状态）
- \`update_post\` — 更新文章（无法修改发布状态）
- \`delete_post\` — 删除文章

## 限制说明

- 你只能在「${input.categoryName}」分类下操作
- 文章创建后状态为私密，需要管理员审核后发布
- 无法修改文章的发布状态

## 安全须知

⚠️ **API Key 安全**：请妥善保管此 API Key。泄露请联系管理员重新生成。

⚠️ **写作安全**：文章内容虽仅作者可见，但请**严禁写入敏感凭据**（如其他服务的 API Key、密码、Token 等）。`;
}

