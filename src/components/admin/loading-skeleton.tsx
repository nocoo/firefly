"use client";

import type { ReactNode } from "react";
import { LayerCard } from "@nocoo/basalt/components/layer-card";
import { SkeletonLine as Bone } from "@nocoo/basalt/components/skeleton-line";
import { AdminPageHeader } from "./page-header";

function BoneStack({
	count,
	className = "h-4 w-full",
}: {
	count: number;
	className?: string;
}) {
	return (
		<>
			{Array.from({ length: count }, (_, index) => (
				<Bone key={index} className={className} minWidth={100} />
			))}
		</>
	);
}

function FilterSkeleton() {
	return (
		<div className="flex flex-wrap gap-basalt-space-lg" aria-hidden="true">
			{Array.from({ length: 5 }, (_, i) => (
				<div key={i} className="w-[8.5rem]">
					<Bone className="h-7 rounded-md" minWidth={100} />
				</div>
			))}
		</div>
	);
}

export function AdminLoadingHeader({
	title,
	description,
	backHref = "/admin",
	backLabel = "返回管理",
}: {
	title: string;
	description: string;
	backHref?: string;
	backLabel?: string;
}) {
	return (
		<AdminPageHeader
			title={title}
			description={description}
			backHref={backHref}
			backLabel={backLabel}
		/>
	);
}

export function AdminLoadingRegion({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div role="status" aria-busy="true" aria-label={label}>
			{children}
		</div>
	);
}

export function AdminFormCardSkeleton({
	title,
	rows = 3,
}: {
	title: string;
	rows?: 1 | 2 | 3 | 4;
}) {
	return (
		<LayerCard>
			<LayerCard.Header>
				<h2 className="text-base font-medium">{title}</h2>
			</LayerCard.Header>
			<LayerCard.Body className="space-y-5" aria-hidden="true">
				{Array.from({ length: rows }, (_, index) => (
					<div key={index} className="space-y-2">
						<Bone className="h-3" maxWidth={42} />
						<Bone className="w-full rounded-md" minWidth={100} height={36} />
					</div>
				))}
			</LayerCard.Body>
		</LayerCard>
	);
}

export function AdminTableSkeleton({
	label,
	columns,
	filters = false,
}: {
	label?: string;
	columns: 4 | 5 | 6 | 9;
	filters?: boolean;
}) {
	const gridStyle = {
		gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
	};
	const table = (
		<div className="space-y-4">
			{filters && <FilterSkeleton />}
			<LayerCard padding="none" className="overflow-hidden" aria-hidden="true">
				<div
					className="grid gap-4 border-b border-border px-4 py-3"
					style={gridStyle}
				>
					{Array.from({ length: columns }, (_, i) => (
						<Bone key={i} className="h-3" maxWidth={70} />
					))}
				</div>
				{Array.from({ length: 6 }, (_, row) => (
					<div
						key={row}
						className="grid gap-4 border-b border-border px-4 py-4 last:border-0"
						style={gridStyle}
					>
						{Array.from({ length: columns }, (_, column) => (
							<Bone
								key={column}
								className="h-4"
								maxWidth={column === 0 ? 75 : 55}
							/>
						))}
					</div>
				))}
			</LayerCard>
		</div>
	);
	return label ? (
		<AdminLoadingRegion label={label}>{table}</AdminLoadingRegion>
	) : (
		table
	);
}

export function AdminMediaGridSkeleton({
	filters = false,
}: {
	filters?: boolean;
} = {}) {
	return (
		<AdminLoadingRegion label="正在加载媒体库">
			<div className="space-y-4">
				{filters && <FilterSkeleton />}
				<div
					className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-16"
					aria-hidden="true"
				>
					{Array.from({ length: 24 }, (_, i) => (
						<div key={i} className="aspect-square">
							<Bone
								className="w-full rounded-md"
								minWidth={100}
								style={{ height: "100%" }}
							/>
						</div>
					))}
				</div>
			</div>
		</AdminLoadingRegion>
	);
}

export function AdminPostEditorSkeleton() {
	return (
		<AdminLoadingRegion label="正在加载文章编辑器">
			<div className="grid gap-6 lg:grid-cols-2">
				<LayerCard>
					<LayerCard.Body className="space-y-5" aria-hidden="true">
						<BoneStack count={2} className="h-9 w-full rounded-md" />
						<Bone className="h-56 w-full rounded-md" minWidth={100} />
						<BoneStack count={4} className="h-9 w-full rounded-md" />
					</LayerCard.Body>
				</LayerCard>
				<LayerCard className="hidden min-h-[32rem] lg:block">
					<LayerCard.Header>预览</LayerCard.Header>
					<LayerCard.Body className="space-y-4" aria-hidden="true">
						<Bone className="h-7" maxWidth={75} />
						<Bone className="h-4" maxWidth={42} />
						<Bone className="h-64 w-full" minWidth={100} />
						<BoneStack count={3} />
					</LayerCard.Body>
				</LayerCard>
			</div>
		</AdminLoadingRegion>
	);
}

export function AdminAnalyticsBodySkeleton() {
	return (
		<AdminLoadingRegion label="正在加载概览统计">
			<div className="grid gap-6 lg:grid-cols-10" aria-hidden="true">
				<div className="space-y-6 lg:col-span-7">
					<LayerCard>
						<LayerCard.Body className="space-y-4">
							<Bone className="h-4" maxWidth={32} />
							<Bone className="h-64 w-full rounded-md" minWidth={100} />
						</LayerCard.Body>
					</LayerCard>
					<div className="grid gap-4 lg:grid-cols-2">
						{[0, 1].map((i) => (
							<LayerCard key={i}>
								<LayerCard.Body className="space-y-4">
									<Bone className="h-4" maxWidth={45} />
									<BoneStack count={5} />
								</LayerCard.Body>
							</LayerCard>
						))}
					</div>
				</div>
				<div className="space-y-3 lg:col-span-3">
					{Array.from({ length: 6 }, (_, i) => (
						<LayerCard key={i}>
							<LayerCard.Body className="space-y-3">
								<Bone className="h-3" maxWidth={52} />
								<Bone className="h-6" maxWidth={36} />
								<Bone className="h-3" maxWidth={65} />
							</LayerCard.Body>
						</LayerCard>
					))}
				</div>
			</div>
		</AdminLoadingRegion>
	);
}

export function AdminSystemMonitorBodySkeleton() {
	return (
		<AdminLoadingRegion label="正在加载系统监控">
			<div className="space-y-6" aria-hidden="true">
				<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
					{Array.from({ length: 4 }, (_, i) => (
						<LayerCard key={i}>
							<LayerCard.Body className="space-y-3">
								<Bone className="h-4" maxWidth={58} />
								<Bone className="h-8" maxWidth={42} />
								<Bone className="h-3" maxWidth={68} />
							</LayerCard.Body>
						</LayerCard>
					))}
				</div>
				<LayerCard>
					<LayerCard.Body className="space-y-4">
						<Bone className="h-4" maxWidth={38} />
						<Bone className="h-64 w-full rounded-md" minWidth={100} />
					</LayerCard.Body>
				</LayerCard>
				<LayerCard>
					<LayerCard.Body className="space-y-3">
						<Bone className="h-4" maxWidth={34} />
						<Bone className="h-4" maxWidth={86} />
					</LayerCard.Body>
				</LayerCard>
			</div>
		</AdminLoadingRegion>
	);
}
