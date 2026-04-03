"use client";

import type { OtherBotDetailResponse } from "@/models/analytics-types";
import { CHART_COLORS, formatNumber } from "./chart-helpers";
import { useLocale } from "@/i18n/context";

interface OtherBotTabProps {
  data: OtherBotDetailResponse;
}

export function OtherBotTab({ data }: OtherBotTabProps) {
  const { t } = useLocale();

  return (
    <div className="space-y-4">
      {/* Category breakdown */}
      <Panel title={t("admin.analytics.categoryBreakdown")}>
        {data.byCategory.length === 0 ? (
          <NoData text={t("admin.analytics.noData")} />
        ) : (
          <div className="space-y-2 text-sm">
            {data.byCategory.map((cat, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor:
                        CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                  <span className="capitalize">{cat.category}</span>
                </div>
                <span className="tabular-nums font-medium">
                  {formatNumber(cat.count)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Two-column: Social + Monitor */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("admin.analytics.socialBots")}>
          {data.socialBots.length === 0 ? (
            <NoData text={t("admin.analytics.noData")} />
          ) : (
            <BotList bots={data.socialBots} />
          )}
        </Panel>

        <Panel title={t("admin.analytics.monitorBots")}>
          {data.monitorBots.length === 0 ? (
            <NoData text={t("admin.analytics.noData")} />
          ) : (
            <BotList bots={data.monitorBots} />
          )}
        </Panel>
      </div>

      {/* Unknown bots with user agent */}
      {data.unknownBots.length > 0 && (
        <Panel title={t("admin.analytics.unknownBots")}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">
                    {t("admin.analytics.tableBot")}
                  </th>
                  <th className="pb-2 font-medium">
                    {t("admin.analytics.tableUserAgent")}
                  </th>
                  <th className="pb-2 font-medium text-right">
                    {t("admin.analytics.tableViews")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.unknownBots.map((bot, i) => (
                  <tr key={i} className="border-t border-border/50">
                    <td className="py-1.5 pr-3">{bot.botName}</td>
                    <td className="py-1.5 pr-3 truncate max-w-[300px] text-muted-foreground text-xs font-mono">
                      {bot.userAgent}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium">
                      {formatNumber(bot.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-widget)] bg-secondary p-4">
      <h3 className="text-sm font-medium text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function NoData({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-4">{text}</p>;
}

function BotList({ bots }: { bots: { botName: string; count: number }[] }) {
  return (
    <div className="space-y-2 text-sm">
      {bots.map((bot, i) => (
        <div key={i} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
              }}
            />
            <span className="truncate max-w-[160px]">{bot.botName}</span>
          </div>
          <span className="tabular-nums font-medium">
            {formatNumber(bot.count)}
          </span>
        </div>
      ))}
    </div>
  );
}
