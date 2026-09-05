import Link from "next/link";

export function JournalBrand({ siteName }: { siteName: string }) {
  return (
    <Link href="/" prefetch={false} className="journal-brand" aria-label={`${siteName} · 首页`} lang="en">
      <span className="journal-brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
      <span>zheng li<span className="journal-brand-period">.</span></span>
    </Link>
  );
}
