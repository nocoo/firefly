import {
	AdminLoadingHeader,
	AdminTableSkeleton,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-4">
			<AdminLoadingHeader title="分类" description="管理文章分类。" />
			<AdminTableSkeleton label="正在加载分类" columns={4} />
		</div>
	);
}
