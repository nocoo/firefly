import {
	AdminLoadingHeader,
	AdminTableSkeleton,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-6">
			<AdminLoadingHeader
				title="AI 代理"
				description="管理可发布内容的 AI 代理。"
			/>
			<AdminTableSkeleton label="正在加载 AI 代理列表" columns={5} />
		</div>
	);
}
