import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/lib/r2";

export async function uploadSettingsImage(file: File): Promise<string> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) throw new Error("请选择 PNG、JPEG、GIF、WebP 或 AVIF 图片。");
  if (file.size > MAX_FILE_SIZE) throw new Error("图片不能超过 10 MB。");
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/media", { method: "POST", body });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "图片上传失败。");
  if (typeof result.url !== "string") throw new Error("上传未返回图片地址。");
  return result.url;
}
