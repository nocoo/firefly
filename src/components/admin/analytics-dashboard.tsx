"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, FolderOpen, Tags } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useSetPageSubtitle } from "@/components/admin/page-subtitle-context";
import type {
  AnalyticsSummaryResponse,
  SourceDetailResponse,
} from "@/models/analytics-types";
import {
  type SourceType,
  SOURCE_TYPES,
  PERIOD_OPTIONS,
  formatNumber,
} from "./analytics/chart-helpers";
import { OverviewCards } from "./analytics/overview-cards";
import { TrafficTrend } from "./analytics/traffic-trend";
import { HumanTab } from "./analytics/human-tab";
import { SearchTab } from "./analytics/search-tab";
import { AiBotTab } from "./analytics/ai-bot-tab";
import { OtherBotTab } from "./analytics/other-bot-tab";
import { SystemMemoryCard } from "./system-memory-card";

// ---------------------------------------------------------------------------
// Tab labels (i18n key mapping)
// ---------------------------------------------------------------------------

const TAB_LABELS: Record<SourceType, string> = {
  human: "人类",
  search: "搜索",
  ai: "AI",
  other: "其他",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface ContentStats {
  postCount: number;
  categoryCount: number;
  tagCount: number;
}

export function AnalyticsDashboard({
  contentStats,
}: {
  contentStats?: ContentStats;
} = {}) {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<AnalyticsSummaryResponse | null>(null);
  const [sourceCache, setSourceCache] = useState<
    Partial<Record<SourceType, SourceDetailResponse>>
  >({});
  const [activeTab, setActiveTab] = useState<SourceType>("human");
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch summary
  const fetchSummary = useCallback(
    async (d: number) => {
      setSummaryLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/analytics?days=${d}`);
        if (!res.ok) throw new Error("获取分析数据失败");
        const json: AnalyticsSummaryResponse = await res.json();
        setSummary(json);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "获取分析数据失败",
        );
      } finally {
        setSummaryLoading(false);
      }
    },
    [],
  );

  // Fetch source detail
  const fetchSourceDetail = useCallback(
    async (type: SourceType, d: number) => {
      setTabLoading(true);
      try {
        const res = await fetch(
          `/api/analytics/source?type=${type}&days=${d}`,
        );
        if (!res.ok) throw new Error("获取分析数据失败");
        const json: SourceDetailResponse = await res.json();
        setSourceCache((prev) => ({ ...prev, [type]: json }));
      } catch {
        // Tab fetch failure is non-critical; user can retry by switching tabs
      } finally {
        setTabLoading(false);
      }
    },
    [],
  );

  // Initial load & period change: summary + active tab
  useEffect(() => {
    fetchSummary(days);
    fetchSourceDetail(activeTab, days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  // Tab switch handler
  function handleTabChange(type: SourceType) {
    setActiveTab(type);
    if (!sourceCache[type]) {
      fetchSourceDetail(type, days);
    }
  }

  // Period change handler
  function handlePeriodChange(newDays: number) {
    setDays(newDays);
    setSourceCache({}); // clear tab cache
  }

  const subtitleText = summary
    ? `${summary.period.startDate} — ${summary.period.endDate}`
    : null;
  useSetPageSubtitle(subtitleText);

  if (error && !summary) {
    return (
      <div className="flex items-center justify-center py-20 text-destructive">
        获取分析数据失败
      </div>
    );
  }

  if (summaryLoading && !summary) {
    return <AnalyticsSkeleton />;
  }

  if (!summary) return null;

  const currentTabData = sourceCache[activeTab];

  // Compute tab counts from overview for badge display
  const tabCounts: Record<SourceType, number> = {
    human: summary.overview.human,
    search: summary.overview.search,
    ai: summary.overview.ai,
    other: summary.overview.otherBot,
  };

  return (
    <div className="grid gap-6 lg:grid-cols-10">
      {/* ── Left column: charts + tabs (7/10) ── */}
      <div className="lg:col-span-7 space-y-6">
        {/* Period selector */}
        <div className="flex items-center justify-end">
          <SegmentedControl
            options={PERIOD_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
            value={days}
            onChange={handlePeriodChange}
          />
        </div>

        {/* Traffic trend chart */}
        <TrafficTrend daily={summary.daily} />

        {/* Source tabs */}
        <div className="space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 rounded-widget border border-border bg-secondary p-1">
            {SOURCE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleTabChange(type)}
                className={`flex-1 flex items-center justify-center gap-2 rounded-[calc(var(--radius-widget)-4px)] px-3 py-2 text-xs font-medium transition-colors ${
                  activeTab === type
                    ? "bg-secondary text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>{TAB_LABELS[type]}</span>
                <span
                  className={`tabular-nums rounded-full px-1.5 py-0.5 text-2xs leading-none ${
                    activeTab === type
                      ? "bg-secondary text-foreground"
                      : "bg-background/50 text-muted-foreground"
                  }`}
                >
                  {formatNumber(tabCounts[type])}
                </span>
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tabLoading && !currentTabData ? (
            <TabSkeleton />
          ) : currentTabData ? (
            <SourceTabContent data={currentTabData} />
          ) : null}
        </div>
      </div>

      {/* ── Right column: stats cards (3/10) ── */}
      <div className="lg:col-span-3 space-y-4">
        {/* Content stats (from server) */}
        {contentStats && (
          <div className="space-y-2">
            <ContentStatCard
              icon={FileText}
              label="已发布文章"
              value={contentStats.postCount}
              index={0}
            />
            <ContentStatCard
              icon={FolderOpen}
              label="分类"
              value={contentStats.categoryCount}
              index={1}
            />
            <ContentStatCard
              icon={Tags}
              label="标签"
              value={contentStats.tagCount}
              index={2}
            />
          </div>
        )}

        {/* Overview stat cards */}
        <OverviewCards overview={summary.overview} days={days} />

        {/* System memory stats */}
        <SystemMemoryCard />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source tab content router
// ---------------------------------------------------------------------------

function SourceTabContent({ data }: { data: SourceDetailResponse }) {
  switch (data.type) {
    case "human":
      return <HumanTab data={data} />;
    case "search":
      return <SearchTab data={data} />;
    case "ai":
      return <AiBotTab data={data} />;
    case "other":
      return <OtherBotTab data={data} />;
  }
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function SkeletonPulse({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[var(--radius-sm)] bg-muted ${className ?? ""}`}
    />
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-10">
      {/* Left */}
      <div className="lg:col-span-7 space-y-6">
        <div className="flex items-center justify-end">
          <SkeletonPulse className="h-8 w-[120px]" />
        </div>
        <div className="rounded-widget bg-secondary p-4 space-y-3">
          <SkeletonPulse className="h-4 w-36" />
          <SkeletonPulse className="h-[260px] w-full" />
        </div>
        <TabSkeleton />
      </div>
      {/* Right */}
      <div className="lg:col-span-3 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-widget bg-secondary p-4"
          >
            <SkeletonPulse className="h-9 w-9 rounded-lg" />
            <div className="space-y-1.5 flex-1">
              <SkeletonPulse className="h-3 w-16" />
              <SkeletonPulse className="h-5 w-10" />
            </div>
          </div>
        ))}
        <div className="space-y-2 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-widget bg-secondary p-4 space-y-2"
            >
              <SkeletonPulse className="h-3 w-20" />
              <SkeletonPulse className="h-6 w-16" />
              <SkeletonPulse className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-widget bg-secondary p-4 space-y-3"
          >
            <SkeletonPulse className="h-4 w-28" />
            {Array.from({ length: 5 }).map((_, j) => (
              <SkeletonPulse key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content stat card (server-provided counts)
// ---------------------------------------------------------------------------

function ContentStatCard({
  icon: Icon,
  label,
  value,
  index = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  index?: number;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-widget bg-secondary p-4 animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold font-display text-foreground">{value}</p>
      </div>
    </div>
  );
}
