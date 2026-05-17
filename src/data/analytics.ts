// ---------------------------------------------------------------------------
// Analytics data layer — barrel re-export.
//
// Implementation split across:
//   - analytics-helpers.ts     (time windows, source conditions, gap-fill, period dates)
//   - analytics-record.ts      (recordPageView)
//   - analytics-overview.ts    (overview / daily trend / aggregates)
//   - analytics-human.ts       (human visitor detail)
//   - analytics-bot-details.ts (search + AI bot detail, shared loader)
//   - analytics-other.ts       (other bot detail)
// ---------------------------------------------------------------------------

export type { RecordPageViewInput } from "./analytics-record";
export { recordPageView } from "./analytics-record";

export {
  TIME_WINDOW_WHERE,
  PREV_WINDOW_WHERE,
  ARTICLE_PATH_RE,
  sourceCondition,
  fillDailyGaps,
  fillDailyByBotGaps,
  formatPathAsTitle,
  computePeriodDates,
  resolveTopPages,
  lookupPostTitleBySlug,
} from "./analytics-helpers";
export type {
  SourceType,
  DailyRow,
  DailyByBotRow,
} from "./analytics-helpers";

export {
  getAnalyticsOverview,
  getAnalyticsDailyTrend,
  getAnalyticsAggregates,
} from "./analytics-overview";

export { getHumanDetail } from "./analytics-human";
export { getSearchDetail, getAiBotDetail } from "./analytics-bot-details";
export { getOtherBotDetail } from "./analytics-other";
