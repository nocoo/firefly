import {
	AdminFormCardSkeleton,
	AdminLoadingHeader,
	AdminLoadingRegion,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-6">
			<AdminLoadingHeader
				title="设置"
				description="管理博客展示选项、文章分页及站点公开元信息。"
			/>
			<AdminLoadingRegion label="正在加载设置">
				<div className="space-y-6">
					<AdminFormCardSkeleton title="显示设置" rows={2} />
					<AdminFormCardSkeleton title="内容设置" rows={1} />
					<AdminFormCardSkeleton title="内部功能链接" rows={4} />
				</div>
			</AdminLoadingRegion>
		</div>
	);
}
