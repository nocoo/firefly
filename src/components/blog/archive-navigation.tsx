import Link from "next/link";
import { Archive, ChevronDown } from "lucide-react";
import type { MonthlyArchive } from "@/data/entities/post";

interface ArchiveEntry {
  slug: string;
  label: string;
  count: number;
}

function ArchiveLinks({ entries }: { entries: ArchiveEntry[] }) {
  return (
    <ul className="blog-sidebar-list">
      {entries.map((entry) => (
        <li key={entry.slug}>
          <Link href={`/archive/${entry.slug}`} prefetch={false}>
            <span>{entry.label}</span>
            <span className="blog-sidebar-count">{entry.count}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ArchiveNavigation({ archives }: { archives: MonthlyArchive[] }) {
  if (archives.length === 0) return null;
  const cutoffYear = new Date().getFullYear() - 1;
  const entries: ArchiveEntry[] = [];
  const olderByYear = new Map<number, number>();
  for (const archive of archives) {
    if (archive.year >= cutoffYear) {
      entries.push({
        slug: `${archive.year}-${String(archive.month).padStart(2, "0")}`,
        label: `${archive.year} 年 ${archive.month} 月`, count: archive.count,
      });
    } else {
      olderByYear.set(archive.year, (olderByYear.get(archive.year) ?? 0) + archive.count);
    }
  }
  for (const [year, count] of [...olderByYear.entries()].sort((a, b) => b[0] - a[0])) {
    entries.push({ slug: String(year), label: `${year} 年`, count });
  }
  const visible = entries.slice(0, 12);
  const remaining = entries.slice(12);

  return (
    <nav className="blog-sidebar-section" aria-labelledby="blog-archive-heading">
      <h3 id="blog-archive-heading" className="blog-sidebar-heading">
        <Archive className="blog-sidebar-heading-icon" strokeWidth={1.5} aria-hidden="true" />
        归档
      </h3>
      <ArchiveLinks entries={visible} />
      {remaining.length > 0 && (
        <details className="blog-archive-more">
          <summary>
            <span className="blog-archive-expand">展开更多 <span className="blog-sidebar-count">+{remaining.length}</span></span>
            <span className="blog-archive-collapse">收起归档</span>
            <ChevronDown aria-hidden="true" strokeWidth={1.5} />
          </summary>
          <ArchiveLinks entries={remaining} />
        </details>
      )}
    </nav>
  );
}
