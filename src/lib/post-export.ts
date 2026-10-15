import type { Post } from "../models/types";
import { renderMarkdown } from "../models/markdown";
import { inlineWeChatHtml } from "./wechat/formatter";

export const POST_EXPORT_FORMATS = ["wechat"] as const;
export type PostExportFormat = (typeof POST_EXPORT_FORMATS)[number];

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

const formatters: Record<PostExportFormat, (post: ExportablePost) => string> = {
  wechat: (post) => inlineWeChatHtml(renderMarkdown(post.content), {
    title: post.title,
    excerpt: post.excerpt ?? undefined,
    featuredImage: post.featured_image ?? undefined,
    referenceUrl: post.reference_url ?? undefined,
    referenceTitle: post.reference_title ?? undefined,
    referenceDescription: post.reference_description ?? undefined,
    referenceImage: post.reference_image ?? undefined,
  }),
};

export function renderPostExport(post: ExportablePost, format: PostExportFormat): string {
  return formatters[format](post);
}
