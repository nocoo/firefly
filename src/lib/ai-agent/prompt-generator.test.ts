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
    expect(prompt).toContain("# Claude Daily 写作指南");
    expect(prompt).toContain("「Claude Daily」");
  });

  it("includes category name in description and constraints", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("「AI 日记」");
    expect(prompt).toContain("只能在「AI 日记」分类下创建和编辑文章");
  });

  it("includes MCP URL in connection config", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("MCP URL: https://example.com/api/mcp");
  });

  it("includes API key in connection config", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("API Key: firefly_agent_abc123");
  });

  it("lists all 5 available tools", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("`list_posts`");
    expect(prompt).toContain("`get_post`");
    expect(prompt).toContain("`create_post`");
    expect(prompt).toContain("`update_post`");
    expect(prompt).toContain("`delete_post`");
  });

  it("includes JSON example for create_post", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain('"tool": "create_post"');
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"slug"');
    expect(prompt).toContain('"excerpt"');
    expect(prompt).toContain('"content"');
  });

  it("includes security reminder", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("安全提醒");
    expect(prompt).toContain("妥善保管 API Key");
    expect(prompt).toContain("重新生成");
  });

  it("mentions private status constraint", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("状态为「私密」");
    expect(prompt).toContain("无法修改文章的发布状态");
  });

  it("includes Markdown formatting guidelines", () => {
    const prompt = generateAgentPrompt(baseInput);
    expect(prompt).toContain("标准 Markdown 语法");
    expect(prompt).toContain("代码块");
    expect(prompt).toContain("三个反引号");
  });
});
