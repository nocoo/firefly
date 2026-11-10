import type { ReactNode } from "react";
import { PageHeader } from "@nocoo/basalt/components/page-header";

interface ListPageHeaderProps {
  title: ReactNode;
  /** Description / count line below the title. Optional. */
  description?: ReactNode;
}

/**
 * Blog list surfaces share Basalt's default page header (title, description below).
 */
export function ListPageHeader({ title, description }: ListPageHeaderProps) {
  return <PageHeader title={title} description={description} />;
}
