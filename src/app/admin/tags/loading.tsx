import {
	AdminLoadingHeader,
	AdminTableSkeleton,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-4">
			<AdminLoadingHeader title="标签" description="管理文章标签。" />
			<AdminTableSkeleton label="正在加载标签" columns={4} />
		</div>
	);
}
