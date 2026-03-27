import { getDb } from "@/lib/db";
import { getR2PublicUrl } from "@/lib/r2-client";
import { listMedia, listMediaYears } from "@/data/media";
import { MediaLibrary } from "@/components/admin/media-library";

export default async function AdminMediaPage() {
  const db = getDb();
  const publicBaseUrl = getR2PublicUrl();
  const [{ media, total }, yearCounts] = await Promise.all([
    listMedia(db, { page: 1, pageSize: 120 }),
    listMediaYears(db),
  ]);

  const mediaWithUrls = media.map((m) => ({
    ...m,
    url: `${publicBaseUrl}/${m.r2_key}`,
  }));

  return (
    <MediaLibrary
      initialMedia={mediaWithUrls}
      initialTotal={total}
      initialYearCounts={yearCounts}
    />
  );
}
