import {
	AdminFormCardSkeleton,
	AdminLoadingHeader,
	AdminLoadingRegion,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-6">
			<AdminLoadingHeader
				title="站点身份"
				description="维护博客名称、标语、介绍、Logo 与社交平台资料。"
			/>
			<AdminLoadingRegion label="正在加载站点身份设置">
				<div className="space-y-6">
					<AdminFormCardSkeleton title="站点图标" rows={1} />
					<AdminFormCardSkeleton title="站点信息" rows={3} />
					<AdminFormCardSkeleton title="作者信息" rows={2} />
					<AdminFormCardSkeleton title="社交链接" rows={2} />
					<AdminFormCardSkeleton title="微信设置" rows={2} />
				</div>
			</AdminLoadingRegion>
		</div>
	);
}
