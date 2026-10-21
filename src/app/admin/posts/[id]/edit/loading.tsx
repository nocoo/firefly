import {
	AdminLoadingHeader,
	AdminPostEditorSkeleton,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-6">
			<AdminLoadingHeader
				title="编辑文章"
				description="更新文章内容、发布信息、分类标签与作者设置。"
				backHref="/admin/posts"
				backLabel="返回文章"
			/>
			<AdminPostEditorSkeleton />
		</div>
	);
}
