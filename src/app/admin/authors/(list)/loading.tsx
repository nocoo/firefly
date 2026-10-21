import {
	AdminLoadingHeader,
	AdminTableSkeleton,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-6">
			<AdminLoadingHeader
				title="作者"
				description="管理人类作者与公开资料。AI 代理仍在「AI 代理」页维护。"
			/>
			<AdminTableSkeleton label="正在加载作者列表" columns={6} />
		</div>
	);
}
