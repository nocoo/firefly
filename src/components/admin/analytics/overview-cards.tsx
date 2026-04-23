"use client";

import type { AnalyticsOverview, DeltaValue } from "@/models/analytics-types";
import { formatNumber, formatDelta } from "./chart-helpers";

interface OverviewCardsProps {
  overview: AnalyticsOverview;
  days: number;
}

export function OverviewCards({ overview, days }: OverviewCardsProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h3 className="text-sm font-medium text-foreground">
          概览
        </h3>
        <span className="text-xs text-muted-foreground">
          {`最近 ${days} 天`}
        </span>
      </div>
      <div className="space-y-2">
        <StatCard
          label="总浏览量"
          value={overview.total}
          delta={overview.totalDelta}
          days={days}
          index={0}
        />
        <StatCard
          label="人类访客"
          value={overview.human}
          delta={overview.humanDelta}
          days={days}
          index={1}
        />
        <StatCard
          label="独立访客"
          value={overview.uniqueVisitors}
          delta={overview.uniqueVisitorsDelta}
          days={days}
          index={2}
        />
        <StatCard
          label="搜索引擎"
          value={overview.search}
          delta={overview.searchDelta}
          days={days}
          index={3}
        />
        <StatCard
          label="AI 爬虫"
          value={overview.ai}
          delta={overview.aiDelta}
          days={days}
          index={4}
        />
        <StatCard
          label="其他爬虫"
          value={overview.otherBot}
          delta={overview.otherBotDelta}
          days={days}
          index={5}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  days,
  index = 0,
}: {
  label: string;
  value: number;
  delta: DeltaValue;
  days: number;
  index?: number;
}) {
  const d = formatDelta(delta, value);
  return (
    <div
      className="rounded-widget bg-secondary p-3 animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`text-xs tabular-nums ${
            d.positive === null
              ? "text-muted-foreground"
              : d.positive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
          }`}
        >
          {d.text}
        </p>
      </div>
      <p className="mt-0.5 text-lg font-semibold font-display text-foreground tabular-nums">
        {formatNumber(value)}
      </p>
      <p className="text-2xs text-muted-foreground/60">
        {`较前 ${days} 天`}
      </p>
    </div>
  );
}
