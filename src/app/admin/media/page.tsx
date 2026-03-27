import { getDb } from "@/lib/db";
import { getR2PublicUrl } from "@/lib/r2-client";
import { listMedia } from "@/data/media";
import { MediaLibrary } from "@/components/admin/media-library";

export default async function AdminMediaPage() {
  const db = getDb();
  const publicBaseUrl = getR2PublicUrl();
  const { media, total } = await listMedia(db, { page: 1, pageSize: 120 });

  const mediaWithUrls = media.map((m) => ({
    ...m,
    url: `${publicBaseUrl}/${m.r2_key}`,
  }));

  return <MediaLibrary initialMedia={mediaWithUrls} initialTotal={total} />;
}
