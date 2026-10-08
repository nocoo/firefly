import { z } from "zod";

export interface WechatSettings {
  wechatName: string;
  wechatQrImageUrl: string;
  wechatAvatarUrl: string;
}

export function isImageUrl(value: string): boolean {
  if (!value) return true;
  if (value.startsWith("/") && !value.startsWith("//")) {
    return !/[\\\s]/.test(value);
  }
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

const imageUrl = z.string().trim().max(2048).refine(isImageUrl, "Use an HTTP(S) image URL or a site-relative path");

export const wechatSettingsSchema = z.object({
  wechat_name: z.string().trim().max(255).optional(),
  wechat_qr_image_url: imageUrl.optional(),
  wechat_avatar_url: imageUrl.optional(),
});
