import {
	AdminAnalyticsBodySkeleton,
	AdminLoadingHeader,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-6">
			<AdminLoadingHeader
				title="概览"
				description="查看博客访问趋势、来源分布与内容数据。"
				backHref="/"
				backLabel="返回首页"
			/>
			<AdminAnalyticsBodySkeleton />
		</div>
	);
}
