import {
	AdminFormCardSkeleton,
	AdminLoadingHeader,
	AdminLoadingRegion,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-6">
			<AdminLoadingHeader
				title="AI 设置"
				description="配置 AI 内容生成服务商、模型及连接认证。"
			/>
			<AdminLoadingRegion label="正在加载 AI 设置">
				<div className="space-y-6">
					<AdminFormCardSkeleton title="服务商 & 模型" rows={2} />
					<AdminFormCardSkeleton title="认证" rows={1} />
				</div>
			</AdminLoadingRegion>
		</div>
	);
}
