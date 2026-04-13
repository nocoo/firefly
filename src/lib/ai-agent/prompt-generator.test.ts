import { describe, it, expect } from "vitest";

import { generateAgentPrompt } from "./prompt-generator";

// ---------------------------------------------------------------------------
// generateAgentPrompt
// ---------------------------------------------------------------------------

describe("generateAgentPrompt", () => {
  const baseInput = {
    agentName: "Claude Daily",
    categoryName: "AI 日记",
    apiKey: "firefly_agent_abc123",
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

  it("includes API key in Authorization header", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain('"Authorization": "Bearer firefly_agent_abc123"');
  });

  it("lists all 5 available tools", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("`list_posts`");
    expect(prompt).toContain("`get_post`");
    expect(prompt).toContain("`create_post`");
    expect(prompt).toContain("`update_post`");
    expect(prompt).toContain("`delete_post`");
  });

  it("includes security reminder about API key", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("API Key 安全");
    expect(prompt).toContain("妥善保管");
    expect(prompt).toContain("重新生成");
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
});
