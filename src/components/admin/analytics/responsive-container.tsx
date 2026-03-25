"use client";

import type { ComponentProps } from "react";
import { ResponsiveContainer as RechartsResponsiveContainer } from "recharts";

const CHART_RESIZE_DEBOUNCE_MS = 180;

type DashboardResponsiveContainerProps = ComponentProps<
  typeof RechartsResponsiveContainer
>;

export function DashboardResponsiveContainer({
  debounce = CHART_RESIZE_DEBOUNCE_MS,
  minWidth = 0,
  minHeight = 0,
  ...props
}: DashboardResponsiveContainerProps) {
  return (
    <RechartsResponsiveContainer
      debounce={debounce}
      minWidth={minWidth}
      minHeight={minHeight}
      {...props}
    />
  );
}
