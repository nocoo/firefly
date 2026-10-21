import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@nocoo/basalt/components/button";
import {
	PageHeader,
	type PageHeaderProps,
} from "@nocoo/basalt/components/page-header";

type AdminPageHeaderProps = Pick<PageHeaderProps, "actions" | "filters"> & {
	title: string;
	description: string;
	backHref: string;
	backLabel: string;
};

export function AdminPageHeader({
	title,
	description,
	backHref,
	backLabel,
	actions,
	filters,
}: AdminPageHeaderProps) {
	return (
		<div data-admin-page-header className="min-w-0 space-y-basalt-layout">
			<div className="flex min-w-0 items-start gap-2">
				<Button variant="ghost" size="icon" asChild className="shrink-0">
					<Link href={backHref} aria-label={backLabel} title={backLabel}>
						<ArrowLeft aria-hidden="true" />
					</Link>
				</Button>
				<div className="min-w-0 flex-1">
					<PageHeader
						title={title}
						description={description}
						actions={actions}
					/>
				</div>
			</div>
			{filters}
		</div>
	);
}
