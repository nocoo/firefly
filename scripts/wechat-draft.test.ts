import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load } from "cheerio";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderPostExport, type ExportablePost } from "../src/lib/post-export";
import { runWeChatDraft } from "./wechat-draft";

const ID = "427cb58b-4590-4f6a-8997-e718f432e04c";
const TOKEN = "fixture-access-token";
const env = {
  MCP_FIREFLY_API_KEY: "fixture-mcp-key",
  WECHAT_APPID: "fixture-app-id",
  WECHAT_APPSECRET: "fixture-app-secret",
};
const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
const post: ExportablePost & {
  id: string;
  slug: string;
  status: "draft" | "published" | "private" | "archived";
  published_at?: number | null;
  canonical_url?: string | null;
  human_name: string | null;
} = {
  id: ID,
  slug: "example-post",
  title: "Example post",
  content: "## Heading\n\n[Link](https://example.com)\n\n![One](https://assets.example.com/body.png?a=1&b=2)\n\n![Two](https://assets.example.com/body.png?a=1&b=2)",
  excerpt: "Article excerpt",
  featured_image: "https://assets.example.com/cover.png",
  reference_url: "https://example.com/reference",
  reference_title: "Reference",
  reference_description: "Description",
  reference_image: "https://assets.example.com/reference.png",
  status: "published",
  published_at: 1773000000,
  human_name: "Li Zheng",
};

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function mockNetwork(options: {
  exportAvailable?: boolean;
  post?: typeof post;
  html?: string;
  override?: (url: URL, init?: RequestInit) => Response | undefined;
} = {}) {
  const article = options.post ?? post;
  let uploadCount = 0;
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const overridden = options.override?.(url, init);
    if (overridden) return overridden;
    if (url.hostname === "lizheng.blog" && url.pathname === "/api/mcp") {
      expect(url.pathname).toBe("/api/mcp");
      expect(init?.method).toBe("POST");
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe(`Bearer ${env.MCP_FIREFLY_API_KEY}`);
      expect(headers.get("accept")).toBe("application/json, text/event-stream");
      expect(headers.get("origin")).toBe("https://lizheng.blog");
      expect(init?.redirect).toBe("error");
      const rpc = JSON.parse(String(init?.body));
      if (rpc.method === "tools/list") {
        return Response.json({ jsonrpc: "2.0", id: rpc.id, result: {
          tools: options.exportAvailable === false ? [{ name: "get_post" }] : [{ name: "get_post" }, { name: "export_post" }],
        } });
      }
      expect(rpc.method).toBe("tools/call");
      let data: unknown;
      if (rpc.params.name === "get_post") data = article;
      else {
        expect(rpc.params.name).toBe("export_post");
        expect(rpc.params.arguments).toEqual({ id: ID, format: "wechat" });
        data = { id: article.id, slug: article.slug, format: "wechat", html: options.html ?? renderPostExport(article, "wechat") };
      }
      return Response.json({ jsonrpc: "2.0", id: rpc.id, result: { content: [{ type: "text", text: JSON.stringify(data) }] } });
    }
    if (url.hostname === "api.weixin.qq.com") {
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("authorization")).toBeNull();
      expect(init?.redirect).toBe("error");
      if (url.pathname === "/cgi-bin/stable_token") {
        expect(JSON.parse(String(init?.body))).toEqual({
          grant_type: "client_credential", appid: env.WECHAT_APPID, secret: env.WECHAT_APPSECRET, force_refresh: false,
        });
        return Response.json({ access_token: TOKEN, expires_in: 7200 });
      }
      expect(url.searchParams.get("access_token")).toBe(TOKEN);
      if (url.pathname === "/cgi-bin/media/uploadimg") {
        return Response.json({ url: `https://mmbiz.qpic.cn/uploaded-${++uploadCount}.png` });
      }
      if (url.pathname === "/cgi-bin/material/add_material") {
        expect(url.searchParams.get("type")).toBe("image");
        return Response.json({ media_id: "fixture-thumb-id" });
      }
      expect(url.pathname).toBe("/cgi-bin/draft/add");
      return Response.json({ media_id: "fixture-draft-id" });
    }
    expect(new Headers(init?.headers).get("authorization")).toBeNull();
    return new Response(png, { headers: { "Content-Type": "image/png" } });
  });
  const log = vi.fn<(message: string) => void>();
  return { fetcher, log, options: { env, fetch: fetcher as typeof fetch, log } };
}

function callsTo(network: ReturnType<typeof mockNetwork>, path: string) {
  return network.fetcher.mock.calls.filter(([url]) => new URL(String(url)).pathname === path);
}

describe("WeChat draft CLI", () => {
  it.each([
    [], ["--dry-run"], ["one", "two"], ["one", "--publish"], ["one", "--dry-run", "--dry-run"], [""],
    [ID, "--source-url"], [ID, "--source-url", "--dry-run"],
    [ID, "--source-url", "https://example.com/one", "--source-url", "https://example.com/two"],
  ])(
    "rejects invalid arguments %j before network access", async (...args) => {
      const network = mockNetwork();
      await expect(runWeChatDraft(args, network.options)).rejects.toThrow("Usage:");
      expect(network.fetcher).not.toHaveBeenCalled();
    },
  );

  it("requires the MCP key without accessing the network", async () => {
    const network = mockNetwork();
    await expect(runWeChatDraft([ID, "--dry-run"], { ...network.options, env: {} })).rejects.toThrow("MCP_FIREFLY_API_KEY is required");
    expect(network.fetcher).not.toHaveBeenCalled();
  });

  it("dry-run validates credentials/images and writes exact private HTML without any uploads or draft writes", async () => {
    const network = mockNetwork();
    const result = await runWeChatDraft([ID, "--dry-run"], network.options);
    expect(result.dryRun).toBe(true);
    if (!result.dryRun) throw new Error("Expected dry run");
    directories.push(join(result.htmlPath, ".."));
    expect(await readFile(result.htmlPath, "utf8")).toBe(renderPostExport(post, "wechat"));
    expect((await stat(result.htmlPath)).mode & 0o777).toBe(0o600);
    expect((await stat(join(result.htmlPath, ".."))).mode & 0o777).toBe(0o700);
    const rpcCalls = callsTo(network, "/api/mcp").map(([, init]) => JSON.parse(String(init?.body)));
    expect(rpcCalls[1].params).toEqual({ name: "get_post", arguments: { id: ID } });
    const wechatPaths = network.fetcher.mock.calls.map(([url]) => new URL(String(url)))
      .filter((url) => url.hostname === "api.weixin.qq.com").map((url) => url.pathname);
    expect(wechatPaths).toEqual(["/cgi-bin/stable_token"]);
    expect(network.fetcher.mock.calls.filter(([url]) => String(url).startsWith("https://assets.example.com"))).toHaveLength(3);
    expect(network.log).toHaveBeenCalledWith(`HTML: ${result.htmlPath}`);
    const logs = network.log.mock.calls.flat().join("\n");
    for (const secret of [...Object.values(env), TOKEN]) expect(logs).not.toContain(secret);
  });

  it("uses the shared local formatter only when tools/list lacks export_post", async () => {
    const network = mockNetwork({ exportAvailable: false });
    const result = await runWeChatDraft(["example-post", "--dry-run"], network.options);
    if (!result.dryRun) throw new Error("Expected dry run");
    directories.push(join(result.htmlPath, ".."));
    expect(result.renderedLocally).toBe(true);
    expect(await readFile(result.htmlPath, "utf8")).toBe(renderPostExport(post, "wechat"));
    const toolCalls = callsTo(network, "/api/mcp").map(([, init]) => JSON.parse(String(init?.body))).filter((call) => call.method === "tools/call");
    expect(toolCalls).toEqual([expect.objectContaining({ params: { name: "get_post", arguments: { slug: "example-post" } } })]);
  });

  it("uploads each distinct body image plus a separate cover material, rewrites URLs, and creates only a draft", async () => {
    const network = mockNetwork();
    expect(await runWeChatDraft([ID], network.options)).toEqual({ dryRun: false, mediaId: "fixture-draft-id", renderedLocally: false });
    expect(callsTo(network, "/cgi-bin/media/uploadimg")).toHaveLength(3);
    expect(callsTo(network, "/cgi-bin/material/add_material")).toHaveLength(1);
    const writes = network.fetcher.mock.calls.filter(([url]) => String(url).startsWith("https://api.weixin.qq.com") && !String(url).includes("stable_token"));
    expect(writes.map(([url]) => new URL(String(url)).pathname)).toEqual([
      "/cgi-bin/media/uploadimg", "/cgi-bin/media/uploadimg", "/cgi-bin/media/uploadimg", "/cgi-bin/material/add_material", "/cgi-bin/draft/add",
    ]);
    for (const [, init] of writes.slice(0, -1)) {
      expect(init?.body).toBeInstanceOf(FormData);
      const file = (init!.body as FormData).get("media") as File;
      expect(file.name).toBe("image.png");
      expect(file.type).toBe("image/png");
      expect(Buffer.from(await file.arrayBuffer())).toEqual(png);
    }
    const article = JSON.parse(String(callsTo(network, "/cgi-bin/draft/add")[0][1]?.body)).articles[0];
    expect(article).toMatchObject({
      title: post.title, author: "李老板", digest: post.excerpt,
      content_source_url: "https://lizheng.blog/2026/03/example-post", thumb_media_id: "fixture-thumb-id",
    });
    const $ = load(article.content);
    const sources = $("img").map((_, img) => $(img).attr("src")).get();
    expect(sources).toHaveLength(4);
    expect(sources.every((src) => src.startsWith("https://mmbiz.qpic.cn/"))).toBe(true);
    expect(sources[2]).toBe(sources[3]);
    expect(article.content).toContain("style=");
    expect(article.content).toContain("wechat-footnotes");
    expect(network.log.mock.calls).toEqual([["media_id: fixture-draft-id"]]);
  });

  it("resolves relative image URLs and strips alternate original image sources after upload", async () => {
    const network = mockNetwork({ html: '<section><img src="/body.png?a=1&amp;b=2" srcset="/alternate.png 2x" sizes="100vw" data-original-src="/original.png"><p>/body.png?a=1&amp;b=2</p></section>' });
    await runWeChatDraft([ID], network.options);
    expect(network.fetcher.mock.calls.some(([url]) => url === "https://lizheng.blog/body.png?a=1&b=2")).toBe(true);
    const content = JSON.parse(String(callsTo(network, "/cgi-bin/draft/add")[0][1]?.body)).articles[0].content;
    expect(content).not.toContain("srcset");
    expect(content).not.toContain("sizes=");
    expect(content).not.toContain("data-original-src");
    expect(content).toContain("<p>/body.png?a=1&amp;b=2</p>");
  });

  it.each([null, "", "   ", "Other Author", "x".repeat(17)])("always uses the fixed author regardless of human_name %j", async (humanName) => {
    const network = mockNetwork({ post: { ...post, human_name: humanName, published_at: null, excerpt: "😀".repeat(120) } });
    await runWeChatDraft([ID], network.options);
    const article = JSON.parse(String(callsTo(network, "/cgi-bin/draft/add")[0][1]?.body)).articles[0];
    expect(article.author).toBe("李老板");
    expect(article.digest).toBe("😀".repeat(120));
    expect(article).not.toHaveProperty("content_source_url");
  });

  it.each([
    { status: "draft" as const, published_at: null },
    { status: "draft" as const, published_at: post.published_at ?? null },
    { status: "private" as const, published_at: post.published_at ?? null },
    { status: "archived" as const, published_at: post.published_at ?? null },
    { status: "published" as const, published_at: null },
    { status: "published" as const, published_at: 0 },
    { status: "published" as const },
  ])("omits source URLs for posts without a public, dated URL: %o", async (fields) => {
    const { published_at: _publishedAt, ...undatedPost } = post;
    const network = mockNetwork({ post: { ...undatedPost, ...fields, canonical_url: "https://lizheng.blog/not-public" } });
    await runWeChatDraft([ID], network.options);
    const article = JSON.parse(String(callsTo(network, "/cgi-bin/draft/add")[0][1]?.body)).articles[0];
    expect(article).not.toHaveProperty("content_source_url");
  });

  it("prefers a server canonical URL for a public dated post", async () => {
    const canonicalUrl = "https://lizheng.blog/2026/04/server-canonical";
    const network = mockNetwork({ post: { ...post, canonical_url: canonicalUrl } });
    await runWeChatDraft([ID], network.options);
    const article = JSON.parse(String(callsTo(network, "/cgi-bin/draft/add")[0][1]?.body)).articles[0];
    expect(article.content_source_url).toBe(canonicalUrl);
  });

  it.each(["Asia/Shanghai", "America/Los_Angeles"])("uses UTC routing at month boundaries regardless of local timezone %s", async (timezone) => {
    const original = process.env.TZ;
    process.env.TZ = timezone;
    try {
      const network = mockNetwork({ post: { ...post, published_at: Date.parse("2026-03-31T23:30:00Z") / 1000 } });
      await runWeChatDraft([ID], network.options);
      const article = JSON.parse(String(callsTo(network, "/cgi-bin/draft/add")[0][1]?.body)).articles[0];
      expect(article.content_source_url).toBe("https://lizheng.blog/2026/03/example-post");
    } finally {
      if (original === undefined) Reflect.deleteProperty(process.env, "TZ");
      else process.env.TZ = original;
    }
  });

  it.each(["draft", "published"] as const)("allows an explicit source URL override for a %s post", async (status) => {
    const network = mockNetwork({ post: { ...post, status, canonical_url: "https://lizheng.blog/old-url" } });
    const sourceUrl = "https://lizheng.blog/2027/01/confirmed-future-url";
    await runWeChatDraft(["--source-url", sourceUrl, ID], network.options);
    const article = JSON.parse(String(callsTo(network, "/cgi-bin/draft/add")[0][1]?.body)).articles[0];
    expect(article.content_source_url).toBe(sourceUrl);
  });

  it("does not resolve article images against the source URL override", async () => {
    const network = mockNetwork({ post: { ...post, status: "draft", published_at: null }, html: '<img src="/body.png">' });
    await runWeChatDraft([ID, "--source-url", "https://example.com/future-article"], network.options);
    expect(network.fetcher.mock.calls.some(([url]) => url === "https://lizheng.blog/body.png")).toBe(true);
    expect(network.fetcher.mock.calls.some(([url]) => String(url).startsWith("https://example.com"))).toBe(false);
  });

  it.each(["/relative", "file:///etc/passwd", "javascript:alert(1)", "https://user:pass@example.com"])("rejects unsafe source URL overrides before network access: %s", async (sourceUrl) => {
    const network = mockNetwork();
    await expect(runWeChatDraft([ID, "--source-url", sourceUrl], network.options)).rejects.toThrow("Source URL must be an absolute HTTP(S) URL without credentials");
    expect(network.fetcher).not.toHaveBeenCalled();
  });

  it.each([
    { fields: { title: "x".repeat(33) }, message: "title exceeds 32 characters" },
    { fields: { excerpt: "x".repeat(121) }, message: "digest exceeds 120 characters" },
  ])("rejects oversized draft metadata before downloads or uploads: $message", async ({ fields, message }) => {
    const network = mockNetwork({ post: { ...post, ...fields } });
    await expect(runWeChatDraft([ID], network.options)).rejects.toThrow(message);
    expect(network.fetcher.mock.calls.every(([url]) => new URL(String(url)).pathname === "/api/mcp")).toBe(true);
  });

  it("accepts metadata at each Unicode code-point limit without truncation", async () => {
    const fields = { title: "😀".repeat(32), excerpt: "😀".repeat(120) };
    const network = mockNetwork({ post: { ...post, ...fields } });
    await runWeChatDraft([ID], network.options);
    const article = JSON.parse(String(callsTo(network, "/cgi-bin/draft/add")[0][1]?.body)).articles[0];
    expect(article).toMatchObject({ title: fields.title, author: "李老板", digest: fields.excerpt });
  });

  it.each([20_000, 20_001])("rejects %i-character HTML before downloads or uploads", async (length) => {
    const network = mockNetwork({ html: `<p>${"x".repeat(length - 7)}</p>` });
    await expect(runWeChatDraft([ID], network.options)).rejects.toThrow("content must be fewer than 20000 characters");
    expect(network.fetcher.mock.calls.every(([url]) => new URL(String(url)).pathname === "/api/mcp")).toBe(true);
  });

  it("accepts 19999-character HTML", async () => {
    const html = `<p>${"x".repeat(19_999 - 7)}</p>`;
    const network = mockNetwork({ html });
    await runWeChatDraft([ID], network.options);
    const article = JSON.parse(String(callsTo(network, "/cgi-bin/draft/add")[0][1]?.body)).articles[0];
    expect(article.content).toBe(html);
  });

  it("revalidates content after uploaded URLs expand before creating the draft", async () => {
    const network = mockNetwork({
      html: `<p>${"x".repeat(19_800)}</p><img src="/body.png">`,
      override: (url) => url.pathname === "/cgi-bin/media/uploadimg"
        ? Response.json({ url: `https://mmbiz.qpic.cn/${"x".repeat(300)}.png` }) : undefined,
    });
    await expect(runWeChatDraft([ID], network.options)).rejects.toThrow("content must be fewer than 20000 characters");
    expect(callsTo(network, "/cgi-bin/material/add_material")).toHaveLength(0);
    expect(callsTo(network, "/cgi-bin/draft/add")).toHaveLength(0);
  });

  it("reads export-style credential lines as data, with environment values taking precedence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "wechat-credentials-test-"));
    directories.push(directory);
    const credentialsPath = join(directory, "credentials.env");
    await writeFile(credentialsPath, `export WECHAT_APPID='file-app-id'\nexport WECHAT_APPSECRET="${env.WECHAT_APPSECRET}"\nexport IGNORED='$(touch should-not-exist)'\n`);
    const network = mockNetwork();
    const result = await runWeChatDraft([ID, "--dry-run"], {
      ...network.options, credentialsPath,
      env: { MCP_FIREFLY_API_KEY: env.MCP_FIREFLY_API_KEY, WECHAT_APPID: env.WECHAT_APPID },
    });
    if (!result.dryRun) throw new Error("Expected dry run");
    directories.push(join(result.htmlPath, ".."));
  });

  it("fails safely when credentials are missing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "wechat-missing-test-"));
    directories.push(directory);
    const network = mockNetwork();
    await expect(runWeChatDraft([ID, "--dry-run"], {
      ...network.options, env: { MCP_FIREFLY_API_KEY: env.MCP_FIREFLY_API_KEY }, credentialsPath: join(directory, "missing.env"),
    })).rejects.toThrow("WECHAT_APPID and WECHAT_APPSECRET are required");
    expect(network.fetcher).not.toHaveBeenCalled();
  });

  it("does not hide MCP authorization errors by falling back to local rendering", async () => {
    const network = mockNetwork({ override: (url) => url.pathname === "/api/mcp" ? new Response(env.MCP_FIREFLY_API_KEY, { status: 401 }) : undefined });
    await expect(runWeChatDraft([ID, "--dry-run"], network.options)).rejects.toThrow("Firefly MCP: HTTP 401");
    expect(network.fetcher).toHaveBeenCalledTimes(1);
  });

  it.each(["rpc", "tool", "invalid-json"])("does not fall back when export_post fails: %s", async (failure) => {
    const network = mockNetwork({ override: (url, init) => {
      if (url.pathname !== "/api/mcp") return;
      const rpc = JSON.parse(String(init?.body));
      if (rpc.params?.name !== "export_post") return;
      if (failure === "rpc") return Response.json({ error: { code: -32603, message: env.MCP_FIREFLY_API_KEY } });
      return Response.json({ result: { isError: failure === "tool", content: [{ type: "text", text: TOKEN }] } });
    } });
    await expect(runWeChatDraft([ID, "--dry-run"], network.options)).rejects.toThrow(/Firefly MCP/);
    expect(callsTo(network, "/cgi-bin/stable_token")).toHaveLength(0);
    expect(network.log).not.toHaveBeenCalled();
  });

  it.each(["/cgi-bin/stable_token", "/cgi-bin/media/uploadimg", "/cgi-bin/material/add_material", "/cgi-bin/draft/add"])(
    "stops on WeChat errors without reflecting secrets or retrying writes: %s", async (path) => {
      const network = mockNetwork({ override: (url) => url.pathname === path ? Response.json({ errcode: 40001, errmsg: `${TOKEN} ${env.WECHAT_APPSECRET}` }) : undefined });
      let failure: unknown;
      try { await runWeChatDraft([ID], network.options); } catch (error) { failure = error; }
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toContain("WeChat error 40001");
      for (const secret of [...Object.values(env), TOKEN]) expect((failure as Error).message).not.toContain(secret);
      expect(callsTo(network, path)).toHaveLength(1);
      if (path !== "/cgi-bin/draft/add") expect(callsTo(network, "/cgi-bin/draft/add")).toHaveLength(0);
      expect(network.log).not.toHaveBeenCalled();
    },
  );

  it("sanitizes network errors containing a credential-bearing request URL", async () => {
    const network = mockNetwork({ override: (url) => {
      if (url.pathname === "/cgi-bin/media/uploadimg") throw new Error(url.href);
    } });
    await expect(runWeChatDraft([ID], network.options)).rejects.toThrow("WeChat image upload: network request failed");
    expect(network.log).not.toHaveBeenCalled();
    expect(callsTo(network, "/cgi-bin/draft/add")).toHaveLength(0);
  });

  it("requires a cover before authenticating or writing to WeChat", async () => {
    const network = mockNetwork({ post: { ...post, featured_image: null } });
    await expect(runWeChatDraft([ID, "--dry-run"], network.options)).rejects.toThrow("featured image");
    expect(callsTo(network, "/cgi-bin/stable_token")).toHaveLength(0);
  });

  it.each(['<img>', '<img src="file:///etc/passwd">', '<img src="https://user:password@example.com/a.png">'])(
    "rejects invalid image sources before any WeChat calls: %s", async (html) => {
      const network = mockNetwork({ html });
      await expect(runWeChatDraft([ID, "--dry-run"], network.options)).rejects.toThrow(/image/i);
      expect(callsTo(network, "/cgi-bin/stable_token")).toHaveLength(0);
    },
  );

  it("preflights all images before any WeChat writes", async () => {
    const network = mockNetwork({ override: (url) => url.pathname === "/body.png" ? new Response("missing", { status: 404 }) : undefined });
    await expect(runWeChatDraft([ID], network.options)).rejects.toThrow("Image download: HTTP 404");
    expect(callsTo(network, "/cgi-bin/media/uploadimg")).toHaveLength(0);
    expect(callsTo(network, "/cgi-bin/material/add_material")).toHaveLength(0);
    expect(callsTo(network, "/cgi-bin/draft/add")).toHaveLength(0);
  });

  it("rejects oversized and corrupt downloads", async () => {
    for (const response of [new Response("too big", { headers: { "Content-Length": String(21 * 1024 * 1024) } }), new Response("not an image")]) {
      const network = mockNetwork({ override: (url) => url.hostname === "assets.example.com" ? response : undefined });
      await expect(runWeChatDraft([ID], network.options)).rejects.toThrow(/Image/);
      expect(callsTo(network, "/cgi-bin/media/uploadimg")).toHaveLength(0);
    }
  });

  it.each([undefined, "1"])("cancels an oversized stream even with absent or misleading content-length %s", async (contentLength) => {
    const cancel = vi.fn();
    const pull = vi.fn((controller: ReadableStreamDefaultController<Uint8Array>) => {
      controller.enqueue(new Uint8Array(1024 * 1024));
    });
    const response = new Response(new ReadableStream({ pull, cancel }, { highWaterMark: 0 }), {
      headers: contentLength ? { "Content-Length": contentLength } : {},
    });
    const network = mockNetwork({ override: (url) => url.hostname === "assets.example.com" ? response : undefined });
    await expect(runWeChatDraft([ID], network.options)).rejects.toThrow("20 MiB download limit");
    expect(pull).toHaveBeenCalledTimes(21);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(callsTo(network, "/cgi-bin/stable_token")).toHaveLength(0);
    expect(callsTo(network, "/cgi-bin/media/uploadimg")).toHaveLength(0);
  });

  it("rejects a PNG whose header is valid but compressed pixels are truncated", async () => {
    const truncated = png.subarray(0, png.length - 25);
    expect((await sharp(truncated).metadata()).format).toBe("png");
    const network = mockNetwork({ override: (url) => url.hostname === "assets.example.com" ? new Response(truncated) : undefined });
    await expect(runWeChatDraft([ID], network.options)).rejects.toThrow("Image could not be decoded or converted for WeChat");
    expect(callsTo(network, "/cgi-bin/stable_token")).toHaveLength(0);
    expect(callsTo(network, "/cgi-bin/media/uploadimg")).toHaveLength(0);
  });

  it("rejects a JPEG with readable metadata but a truncated scan", async () => {
    const jpeg = await sharp(png).jpeg().toBuffer();
    const truncated = jpeg.subarray(0, jpeg.length - 2);
    expect((await sharp(truncated).metadata()).format).toBe("jpeg");
    const network = mockNetwork({ override: (url) => url.hostname === "assets.example.com" ? new Response(truncated) : undefined });
    await expect(runWeChatDraft([ID], network.options)).rejects.toThrow("Image could not be decoded or converted for WeChat");
    expect(callsTo(network, "/cgi-bin/stable_token")).toHaveLength(0);
    expect(callsTo(network, "/cgi-bin/media/uploadimg")).toHaveLength(0);
  });

  it.each(["missing", "broken"])("sanitizes %s image response streams before any writes", async (failure) => {
    const response = failure === "missing" ? new Response(null) : new Response(new ReadableStream({
      start(controller) { controller.error(new Error(TOKEN)); },
    }));
    const network = mockNetwork({ override: (url) => url.hostname === "assets.example.com" ? response : undefined });
    await expect(runWeChatDraft([ID], network.options)).rejects.toThrow("Could not read image download");
    expect(callsTo(network, "/cgi-bin/stable_token")).toHaveLength(0);
    expect(network.log).not.toHaveBeenCalled();
  });

  it("preserves fully decoded JPEG bytes below the body-image limit", async () => {
    const jpeg = await sharp(png).jpeg().toBuffer();
    const network = mockNetwork({ override: (url) => url.hostname === "assets.example.com" ? new Response(jpeg) : undefined });
    await runWeChatDraft([ID], network.options);
    const form = callsTo(network, "/cgi-bin/media/uploadimg")[0][1]?.body as FormData;
    const file = form.get("media") as File;
    expect(file.type).toBe("image/jpeg");
    expect(file.name).toBe("image.jpg");
    expect(Buffer.from(await file.arrayBuffer())).toEqual(jpeg);
  });

  it("converts unsupported WebP images to JPEG before uploading", async () => {
    const webp = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).webp().toBuffer();
    const network = mockNetwork({ override: (url) => url.hostname === "assets.example.com" ? new Response(webp) : undefined });
    await runWeChatDraft([ID], network.options);
    const form = callsTo(network, "/cgi-bin/media/uploadimg")[0][1]?.body as FormData;
    const file = form.get("media") as File;
    expect(file.type).toBe("image/jpeg");
    expect(file.name).toBe("image.jpg");
    expect((await sharp(Buffer.from(await file.arrayBuffer())).metadata()).format).toBe("jpeg");
  });
});
