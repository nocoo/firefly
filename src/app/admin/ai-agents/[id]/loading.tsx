import {
	AdminFormCardSkeleton,
	AdminLoadingHeader,
	AdminLoadingRegion,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-6">
			<AdminLoadingHeader
				title="AI 代理"
				description="正在加载 AI 代理资料表单。"
				backHref="/admin/ai-agents"
				backLabel="返回 AI 代理"
			/>
			<AdminLoadingRegion label="正在加载 AI 代理表单">
				<AdminFormCardSkeleton title="代理资料" rows={4} />
			</AdminLoadingRegion>
		</div>
	);
}
