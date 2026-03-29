"use client";

import type { AnalyticsOverview, DeltaValue } from "@/models/analytics-types";
import { formatNumber, formatDelta } from "./chart-helpers";
import { useLocale } from "@/i18n/context";

interface OverviewCardsProps {
  overview: AnalyticsOverview;
  days: number;
}

export function OverviewCards({ overview, days }: OverviewCardsProps) {
  const { t } = useLocale();
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-foreground">
          {t("admin.analytics.overview")}
        </h3>
        <span className="text-xs text-muted-foreground">
          {t("admin.analytics.periodLabel", { days })}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label={t("admin.analytics.totalViews")}
          value={overview.total}
          delta={overview.totalDelta}
          days={days}
        />
        <StatCard
          label={t("admin.analytics.humanVisitors")}
          value={overview.human}
          delta={overview.humanDelta}
          days={days}
        />
        <StatCard
          label={t("admin.analytics.uniqueVisitors")}
          value={overview.uniqueVisitors}
          delta={overview.uniqueVisitorsDelta}
          days={days}
        />
        <StatCard
          label={t("admin.analytics.searchEngines")}
          value={overview.search}
          delta={overview.searchDelta}
          days={days}
        />
        <StatCard
          label={t("admin.analytics.aiBots")}
          value={overview.ai}
          delta={overview.aiDelta}
          days={days}
        />
        <StatCard
          label={t("admin.analytics.otherBots")}
          value={overview.otherBot}
          delta={overview.otherBotDelta}
          days={days}
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
}: {
  label: string;
  value: number;
  delta: DeltaValue;
  days: number;
}) {
  const { t } = useLocale();
  const d = formatDelta(delta, value);
  return (
    <div className="rounded-[var(--radius-widget)] bg-secondary p-4">
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground/60">
          {t("admin.analytics.vsPrev", { days })}
        </p>
      </div>
      <p className="mt-1 text-2xl font-semibold font-display text-foreground tabular-nums">
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
