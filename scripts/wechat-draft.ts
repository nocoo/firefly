#!/usr/bin/env bun
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { load } from "cheerio";
import { parse } from "dotenv";
import sharp from "sharp";
import { z } from "zod";
import { renderPostExport } from "../src/lib/post-export";
import { postPath } from "../src/lib/seo";

const SITE_URL = "https://lizheng.blog";
const WECHAT_URL = "https://api.weixin.qq.com";
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const MAX_BODY_IMAGE_BYTES = 1024 * 1024;

const postSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  content: z.string(),
  excerpt: z.string().nullable(),
  featured_image: z.string().nullable(),
  reference_url: z.string().nullable(),
  reference_title: z.string().nullable(),
  reference_description: z.string().nullable(),
  reference_image: z.string().nullable(),
  status: z.enum(["draft", "published", "private", "archived"]),
  published_at: z.number().int().nullish(),
  canonical_url: z.string().nullable().optional(),
  human_name: z.string().nullable().optional(),
});

interface RunOptions {
  env?: Readonly<Record<string, string | undefined>>;
  credentialsPath?: string;
  fetch?: typeof fetch;
  log?: (message: string) => void;
}

interface ImageAsset {
  bytes: Uint8Array<ArrayBuffer>;
  type: string;
  filename: string;
}

class DraftError extends Error {}

function validated<T>(schema: z.ZodType<T>, data: unknown, operation: string): T {
  const result = schema.safeParse(data);
  if (!result.success) throw new DraftError(`${operation}: invalid response`);
  return result.data;
}

async function request(fetcher: typeof fetch, url: string, init: RequestInit, operation: string) {
  let response: Response;
  try {
    response = await fetcher(url, {
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      ...init,
    });
  } catch {
    // Fetch errors can contain credential-bearing URLs; never forward them.
    throw new DraftError(`${operation}: network request failed`);
  }
  if (!response.ok) throw new DraftError(`${operation}: HTTP ${response.status}`);
  return response;
}

async function requestJson(fetcher: typeof fetch, url: string, init: RequestInit, operation: string) {
  const response = await request(fetcher, url, init, operation);
  try {
    return validated(z.record(z.string(), z.unknown()), await response.json(), operation);
  } catch (error) {
    if (error instanceof DraftError) throw error;
    throw new DraftError(`${operation}: invalid JSON response`);
  }
}

async function loadCredentials(env: Readonly<Record<string, string | undefined>>, credentialsPath: string) {
  let file: Record<string, string> = {};
  if (!env.WECHAT_APPID || !env.WECHAT_APPSECRET) {
    try {
      file = parse(await readFile(credentialsPath));
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
        throw new DraftError("Could not read WeChat credentials file");
      }
    }
  }
  const appid = env.WECHAT_APPID || file.WECHAT_APPID;
  const secret = env.WECHAT_APPSECRET || file.WECHAT_APPSECRET;
  if (!appid || !secret) throw new DraftError("WECHAT_APPID and WECHAT_APPSECRET are required");
  return { appid, secret };
}

function imageUrl(src: string, sourceUrl: string): string {
  let url: URL;
  try {
    url = new URL(src, sourceUrl);
  } catch {
    throw new DraftError("Invalid article image URL");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new DraftError("Article images must use HTTP(S) URLs without credentials");
  }
  return url.href;
}

function validatedSourceUrl(value: string): string {
  try {
    const url = new URL(value);
    if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch {
    // Do not echo a potentially credential-bearing URL.
  }
  throw new DraftError("Source URL must be an absolute HTTP(S) URL without credentials");
}

function validateDraft(article: { title: string; author: string; digest: string; content: string }) {
  for (const [field, limit] of [["title", 32], ["author", 16], ["digest", 120]] as const) {
    const length = [...article[field]].length;
    if (length > limit) throw new DraftError(`WeChat draft ${field} exceeds ${limit} characters (${length})`);
  }
  const length = [...article.content].length;
  if (length >= 20_000) throw new DraftError(`WeChat draft content must be fewer than 20000 characters (${length})`);
}

async function downloadImage(fetcher: typeof fetch, url: string): Promise<ImageAsset> {
  const response = await request(fetcher, url, { redirect: "follow" }, "Image download");
  if (Number(response.headers.get("content-length")) > MAX_DOWNLOAD_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new DraftError("Image exceeds the 20 MiB download limit");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new DraftError("Could not read image download");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_DOWNLOAD_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new DraftError("Image exceeds the 20 MiB download limit");
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof DraftError) throw error;
    throw new DraftError("Could not read image download");
  } finally {
    reader.releaseLock();
  }
  let bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (["jpeg", "png"].includes(metadata.format ?? "") && bytes.byteLength < MAX_BODY_IMAGE_BYTES) {
      await image.stats();
      const png = metadata.format === "png";
      return { bytes, type: png ? "image/png" : "image/jpeg", filename: png ? "image.png" : "image.jpg" };
    }
    bytes = new Uint8Array(await image.rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" }).jpeg({ quality: 80 }).toBuffer());
  } catch {
    throw new DraftError("Image could not be decoded or converted for WeChat");
  }
  if (bytes.byteLength >= MAX_BODY_IMAGE_BYTES) throw new DraftError("Converted image exceeds the 1 MiB WeChat body-image limit");
  return { bytes, type: "image/jpeg", filename: "image.jpg" };
}

export async function runWeChatDraft(args: string[], options: RunOptions = {}) {
  const usage = "Usage: bun scripts/wechat-draft.ts <post id or slug> [--dry-run] [--source-url <url>]";
  let identifier: string | undefined;
  let dryRun = false;
  let sourceOverride: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run" && !dryRun) dryRun = true;
    else if (arg === "--source-url" && sourceOverride === undefined && args[i + 1] && !args[i + 1].startsWith("--")) {
      sourceOverride = validatedSourceUrl(args[++i]);
    } else if (!arg.startsWith("--") && identifier === undefined && arg.trim()) identifier = arg;
    else throw new DraftError(usage);
  }
  if (!identifier) throw new DraftError(usage);
  const env = options.env ?? process.env;
  const fetcher = options.fetch ?? fetch;
  const log = options.log ?? console.log;
  const key = env.MCP_FIREFLY_API_KEY;
  if (!key) throw new DraftError("MCP_FIREFLY_API_KEY is required");
  const credentials = await loadCredentials(env, options.credentialsPath ?? join(homedir(), ".config/wechat/credentials.env"));
  let requestId = 0;

  async function rpc(method: string, params: Record<string, unknown>) {
    const data = await requestJson(fetcher, `${SITE_URL}/api/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        Accept: "application/json, text/event-stream",
        Origin: SITE_URL,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    }, "Firefly MCP");
    if (data.error) throw new DraftError("Firefly MCP: JSON-RPC request failed");
    return data.result;
  }

  async function callTool(name: string, toolArgs: Record<string, unknown>) {
    const result = validated(z.object({
      isError: z.boolean().optional(),
      content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
    }), await rpc("tools/call", { name, arguments: toolArgs }), "Firefly MCP tool");
    if (result.isError) throw new DraftError(`Firefly MCP: ${name} failed`);
    const text = result.content.find((item) => item.type === "text")?.text;
    if (!text) throw new DraftError("Firefly MCP: missing tool result");
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new DraftError("Firefly MCP: invalid tool JSON");
    }
  }

  const tools = validated(z.object({ tools: z.array(z.object({ name: z.string() })) }),
    await rpc("tools/list", {}), "Firefly MCP tool list");
  const byId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(identifier);
  const post = validated(postSchema, await callTool("get_post", byId ? { id: identifier } : { slug: identifier }), "Firefly post");
  const renderedLocally = !tools.tools.some((tool) => tool.name === "export_post");
  const html = renderedLocally ? renderPostExport(post, "wechat") : validated(z.object({
    id: z.literal(post.id), slug: z.literal(post.slug), format: z.literal("wechat"), html: z.string().min(1),
  }), await callTool("export_post", { id: post.id, format: "wechat" }), "Firefly export").html;
  if (!post.featured_image) throw new DraftError("Post needs a featured image for the WeChat draft cover");
  const publicSourceUrl = post.status === "published" && post.published_at
    ? validatedSourceUrl(post.canonical_url ?? `${SITE_URL}${postPath(post.slug, post.published_at)}`)
    : undefined;
  const sourceUrl = sourceOverride ?? publicSourceUrl;
  const imageBaseUrl = publicSourceUrl ?? `${SITE_URL}/`;
  const $ = load(html, null, false);
  const article = {
    title: post.title,
    author: post.human_name?.trim() || "Zheng Li",
    digest: post.excerpt ?? "",
    content: $.html(),
    ...(sourceUrl ? { content_source_url: sourceUrl } : {}),
  };
  validateDraft(article);
  const imageSources = new Set<string>();
  $("img").each((_, element) => {
    const src = $(element).attr("src");
    if (!src) throw new DraftError("Article contains an image without src");
    imageSources.add(imageUrl(src, imageBaseUrl));
  });
  const coverUrl = imageUrl(post.featured_image, imageBaseUrl);
  imageSources.add(coverUrl);
  const images = new Map<string, ImageAsset>();
  for (const url of imageSources) images.set(url, await downloadImage(fetcher, url));

  async function wechat(path: string, init: RequestInit, operation: string) {
    const data = await requestJson(fetcher, `${WECHAT_URL}${path}`, { method: "POST", ...init }, operation);
    const status = validated(z.object({ errcode: z.number().int().optional() }), data, operation);
    if (status.errcode) throw new DraftError(`${operation}: WeChat error ${status.errcode}`);
    return data;
  }

  const tokenData = await wechat("/cgi-bin/stable_token", {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credential", ...credentials, force_refresh: false }),
  }, "WeChat authentication");
  const token = validated(z.string().min(1), tokenData.access_token, "WeChat authentication");

  if (dryRun) {
    const directory = await mkdtemp(join(tmpdir(), "firefly-wechat-"));
    const htmlPath = join(directory, "article.html");
    await writeFile(htmlPath, html, { mode: 0o600 });
    log(`Dry run: ${renderedLocally ? "local shared formatter" : "MCP export_post"}; ${images.size} image(s) validated; no WeChat uploads or draft writes`);
    log(`HTML: ${htmlPath}`);
    return { dryRun: true as const, htmlPath, renderedLocally };
  }

  async function upload(path: string, url: string, field: "url" | "media_id") {
    const image = images.get(url);
    if (!image) throw new DraftError("Image was not validated before upload");
    const form = new FormData();
    form.append("media", new Blob([image.bytes], { type: image.type }), image.filename);
    const data = await wechat(`${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`,
      { body: form }, "WeChat image upload");
    return validated(z.string().min(1), data[field], "WeChat image upload");
  }

  const replacements = new Map<string, string>();
  for (const element of $("img").toArray()) {
    const image = $(element);
    const url = imageUrl(image.attr("src") ?? "", imageBaseUrl);
    let uploaded = replacements.get(url);
    if (!uploaded) {
      const value = await upload("/cgi-bin/media/uploadimg", url, "url");
      let uploadedUrl: URL;
      try {
        uploadedUrl = new URL(value);
      } catch {
        throw new DraftError("WeChat image upload: invalid image URL");
      }
      if (!["http:", "https:"].includes(uploadedUrl.protocol)) throw new DraftError("WeChat image upload: invalid image URL");
      uploaded = uploadedUrl.href;
      replacements.set(url, uploaded);
    }
    image.attr("src", uploaded).removeAttr("srcset").removeAttr("sizes").removeAttr("data-original-src");
  }
  article.content = $.html();
  validateDraft(article);
  const thumbMediaId = await upload("/cgi-bin/material/add_material?type=image", coverUrl, "media_id");
  const draft = await wechat(`/cgi-bin/draft/add?access_token=${encodeURIComponent(token)}`, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ articles: [{
      ...article,
      thumb_media_id: thumbMediaId,
    }] }),
  }, "WeChat draft creation");
  const mediaId = validated(z.string().min(1), draft.media_id, "WeChat draft creation");
  log(`media_id: ${mediaId}`);
  return { dryRun: false as const, mediaId, renderedLocally };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runWeChatDraft(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof DraftError ? error.message : "WeChat draft operation failed");
    process.exitCode = 1;
  });
}
