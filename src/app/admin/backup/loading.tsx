import {
	AdminFormCardSkeleton,
	AdminLoadingHeader,
	AdminLoadingRegion,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-6">
			<AdminLoadingHeader
				title="备份"
				description="配置站点数据备份推送与恢复所需的连接信息。"
			/>
			<AdminLoadingRegion label="正在加载备份设置">
				<div className="space-y-6">
					<AdminFormCardSkeleton title="推送 Webhook" rows={3} />
					<AdminFormCardSkeleton title="拉取 Webhook" rows={2} />
				</div>
			</AdminLoadingRegion>
		</div>
	);
}
