import {
	AdminLoadingHeader,
	AdminTableSkeleton,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-6">
			<AdminLoadingHeader
				title="文章"
				description="管理文章及其发布状态、分类和标签。"
			/>
			<AdminTableSkeleton label="正在加载文章列表" columns={9} filters />
		</div>
	);
}
