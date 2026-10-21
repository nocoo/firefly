import {
	AdminLoadingHeader,
	AdminPostEditorSkeleton,
} from "@/components/admin/loading-skeleton";

export default function Loading() {
	return (
		<div className="space-y-6">
			<AdminLoadingHeader
				title="新建文章"
				description="撰写文章并设置发布信息、分类标签与作者。"
				backHref="/admin/posts"
				backLabel="返回文章"
			/>
			<AdminPostEditorSkeleton />
		</div>
	);
}
