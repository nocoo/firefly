import { Skeleton } from "@nocoo/basalt/components/skeleton";
import {
  AdminFormCardSkeleton,
  AdminLoadingHeader,
  AdminLoadingRegion,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
  return (
    <div className="max-w-xl space-y-6">
      <AdminLoadingHeader
        title="作者"
        description="正在加载作者资料表单。"
        backHref="/admin/authors"
        backLabel="返回作者"
      />
      <AdminLoadingRegion label="正在加载作者表单">
        <div className="space-y-4" aria-hidden="true">
          <div className="h-16 w-16" aria-hidden="true">
            <Skeleton className="h-full w-full rounded-full" variant="circle" />
          </div>
          <AdminFormCardSkeleton title="作者资料" rows={4} />
        </div>
      </AdminLoadingRegion>
    </div>
  );
}
