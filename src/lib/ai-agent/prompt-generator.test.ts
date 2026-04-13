import { describe, it, expect } from "vitest";

import { generateAgentPrompt } from "./prompt-generator";

// ---------------------------------------------------------------------------
// generateAgentPrompt
// ---------------------------------------------------------------------------

describe("generateAgentPrompt", () => {
  const baseInput = {
    agentName: "Claude Daily",
    agentId: "01HQ12345ABCDE",
    categoryName: "AI 日记",
    mcpUrl: "https://example.com/api/mcp",
  };

  it("includes agent name in title and description", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("# Claude Daily MCP 连接指南");
    expect(prompt).toContain("「Claude Daily」");
  });

  it("includes category name in description and constraints", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("「AI 日记」");
    expect(prompt).toContain("自动归入「AI 日记」分类");
  });

  it("includes MCP URL in JSON connection config", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain('"url": "https://example.com/api/mcp"');
  });

  it("includes author_id in description and example", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("`01HQ12345ABCDE`");
    expect(prompt).toContain('"author_id": "01HQ12345ABCDE"');
    expect(prompt).toContain("author_id");
  });

  it("lists all 8 available tools (5 post + 3 tag)", () => {
    const prompt = generateAgentPrompt(baseInput);
    // Post tools
    expect(prompt).toContain("`list_posts`");
    expect(prompt).toContain("`get_post`");
    expect(prompt).toContain("`create_post`");
    expect(prompt).toContain("`update_post`");
    expect(prompt).toContain("`delete_post`");
    // Tag tools
    expect(prompt).toContain("`list_tags`");
    expect(prompt).toContain("`get_tag`");
    expect(prompt).toContain("`create_tag`");
  });

  it("clarifies author_id is only needed for post tools", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("文章管理**工具调用中，你必须在 arguments 中带上 `author_id`");
    expect(prompt).toContain("标签工具无需此参数");
    expect(prompt).toContain("### 文章管理（需要 author_id）");
    expect(prompt).toContain("### 标签查询（无需 author_id）");
  });

  it("documents tag tool constraints", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("标签是全局资源");
    expect(prompt).toContain("无法修改或删除已有标签");
  });

  it("includes warning about sensitive credentials in content", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("写作安全");
    expect(prompt).toContain("严禁写入敏感凭据");
    expect(prompt).toContain("API Key、密码、Token");
  });

  it("mentions private status constraint", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("状态为私密");
    expect(prompt).toContain("无法修改文章的发布状态");
  });

  it("includes valid JSON config block with mcpServers structure", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain('"mcpServers"');
    expect(prompt).toContain('"firefly"');
    expect(prompt).toContain('"headers"');
  });

  it("mentions OAuth token placeholder instead of hardcoded key", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("<YOUR_OAUTH_TOKEN>");
    expect(prompt).toContain("OAuth 授权");
  });
});
