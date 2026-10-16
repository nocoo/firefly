import type { Post } from "../models/types";
import { renderMarkdown } from "../models/markdown";
import { inlineWeChatHtml } from "./wechat/formatter";
import { formatWebsiteHtml, type WebsiteImage } from "./website/formatter";

export const POST_EXPORT_FORMATS = ["wechat", "website"] as const;
export const POST_EXPORT_SITE_URL = "https://lizheng.blog";
export type PostExportFormat = (typeof POST_EXPORT_FORMATS)[number];

export interface PostExportContent {
  html: string;
  images?: WebsiteImage[];
}

export type ExportablePost = Pick<Post,
  | "content"
  | "title"
  | "excerpt"
  | "featured_image"
  | "reference_url"
  | "reference_title"
  | "reference_description"
  | "reference_image"
>;

const formatters: Record<PostExportFormat, (post: ExportablePost, baseUrl: string) => PostExportContent> = {
  wechat: (post) => ({
    html: inlineWeChatHtml(renderMarkdown(post.content), {
      title: post.title,
      excerpt: post.excerpt ?? undefined,
      featuredImage: post.featured_image ?? undefined,
      referenceUrl: post.reference_url ?? undefined,
      referenceTitle: post.reference_title ?? undefined,
      referenceDescription: post.reference_description ?? undefined,
      referenceImage: post.reference_image ?? undefined,
    }),
  }),
  website: (post, baseUrl) => formatWebsiteHtml(renderMarkdown(post.content), baseUrl),
};

export function renderPostExport(
  post: ExportablePost,
  format: PostExportFormat,
  baseUrl = POST_EXPORT_SITE_URL,
): PostExportContent {
  return formatters[format](post, baseUrl);
}
