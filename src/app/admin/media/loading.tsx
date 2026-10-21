import {
	AdminLoadingHeader,
	AdminMediaGridSkeleton,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-6">
			<AdminLoadingHeader title="媒体库" description="浏览并筛选已上传文件。" />
			<AdminMediaGridSkeleton filters />
		</div>
	);
}
