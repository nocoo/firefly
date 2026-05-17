// ---------------------------------------------------------------------------
// Media library — shared types + helpers + FileTypeIcon
// ---------------------------------------------------------------------------

import type { ReactElement } from "react";
import {
  File,
  FileArchive,
  FileAudio,
  FileText,
  FileVideo,
  ImageIcon,
} from "lucide-react";
import type { Attachment } from "@/models/types";

export interface MediaWithUrl extends Attachment {
  url: string;
}

export interface Filters {
  search: string;
  mimeType: string;
  year: string;
  month: string;
  sortBy: string;
  sortOrder: string;
}

export const EMPTY_FILTERS: Filters = {
  search: "",
  mimeType: "",
  year: "",
  month: "",
  sortBy: "created_at",
  sortOrder: "desc",
};

export const PAGE_SIZE = 120;

export const MONTH_LABELS = [
  "",
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月",
];

export const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const ARCHIVE_MIME_TYPES = new Set([
  "application/zip",
  "application/x-rar-compressed",
  "application/gzip",
  "application/x-7z-compressed",
  "application/x-tar",
]);

/** Whether a MIME type is a renderable image (excluding SVG). */
export function isImageMime(mime: string): boolean {
  return mime.startsWith("image/") && !mime.includes("svg");
}

/** Return the appropriate lucide icon for a given MIME type. */
export function FileTypeIcon({
  mime,
  className,
}: {
  mime: string;
  className?: string;
}): ReactElement {
  if (mime.startsWith("image/")) return <ImageIcon className={className} />;
  if (mime.startsWith("audio/")) return <FileAudio className={className} />;
  if (mime.startsWith("video/")) return <FileVideo className={className} />;
  if (mime === "application/pdf") return <FileText className={className} />;
  if (ARCHIVE_MIME_TYPES.has(mime)) return <FileArchive className={className} />;
  return <File className={className} />;
}

export function buildQuery(filters: Filters, page: number): string {
  const sp = new URLSearchParams();
  sp.set("page", String(page));
  sp.set("page_size", String(PAGE_SIZE));
  if (filters.search) sp.set("search", filters.search);
  if (filters.mimeType) sp.set("mime_type", filters.mimeType);
  if (filters.year) sp.set("year", filters.year);
  if (filters.year && filters.month) sp.set("month", filters.month);
  if (filters.sortBy && filters.sortBy !== "created_at")
    sp.set("sort_by", filters.sortBy);
  if (filters.sortOrder && filters.sortOrder !== "desc")
    sp.set("sort_order", filters.sortOrder);
  return sp.toString();
}

export function hasActiveFilters(f: Filters): boolean {
  return (
    f.search !== "" ||
    f.mimeType !== "" ||
    f.year !== "" ||
    f.sortBy !== "created_at" ||
    f.sortOrder !== "desc"
  );
}

export function formatDate(epoch: number): string {
  return new Date(epoch * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
