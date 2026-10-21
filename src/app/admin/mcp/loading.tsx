import {
	AdminFormCardSkeleton,
	AdminLoadingHeader,
	AdminLoadingRegion,
	AdminTableSkeleton,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-6">
			<AdminLoadingHeader
				title="MCP 令牌"
				description="创建和管理 MCP 访问令牌及其权限范围。"
			/>
			<AdminLoadingRegion label="正在加载 MCP 令牌管理">
				<div className="space-y-6">
					<AdminFormCardSkeleton title="MCP 连接指南" rows={2} />
					<AdminFormCardSkeleton title="创建令牌" rows={2} />
					<AdminTableSkeleton columns={5} />
				</div>
			</AdminLoadingRegion>
		</div>
	);
}
