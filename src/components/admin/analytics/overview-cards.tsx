"use client";

import type { AnalyticsOverview, DeltaValue } from "@/models/analytics-types";
import { formatNumber, formatDelta } from "./chart-helpers";
import { useLocale } from "@/i18n/context";

interface OverviewCardsProps {
  overview: AnalyticsOverview;
}

export function OverviewCards({ overview }: OverviewCardsProps) {
  const { t } = useLocale();
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard
        label={t("admin.analytics.totalViews")}
        value={overview.total}
        delta={overview.totalDelta}
      />
      <StatCard
        label={t("admin.analytics.humanVisitors")}
        value={overview.human}
        delta={overview.humanDelta}
      />
      <StatCard
        label={t("admin.analytics.uniqueVisitors")}
        value={overview.uniqueVisitors}
        delta={overview.uniqueVisitorsDelta}
      />
      <StatCard
        label={t("admin.analytics.searchEngines")}
        value={overview.search}
        delta={overview.searchDelta}
      />
      <StatCard
        label={t("admin.analytics.aiBots")}
        value={overview.ai}
        delta={overview.aiDelta}
      />
      <StatCard
        label={t("admin.analytics.otherBots")}
        value={overview.otherBot}
        delta={overview.otherBotDelta}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: number;
  delta: DeltaValue;
}) {
  const d = formatDelta(delta);
  return (
    <div className="rounded-[var(--radius-widget)] bg-secondary p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
        {formatNumber(value)}
      </p>
      <p
        className={`mt-0.5 text-xs tabular-nums ${
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
  );
}
