import {
	AdminLoadingHeader,
	AdminSystemMonitorBodySkeleton,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-6">
			<AdminLoadingHeader
				title="系统监控"
				description="查看服务内存占用、历史趋势与运行状态。"
			/>
			<AdminSystemMonitorBodySkeleton />
		</div>
	);
}
