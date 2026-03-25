// ---------------------------------------------------------------------------
// Analytics response types — four-source analytics redesign
// Pure interfaces, no runtime dependencies
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Summary endpoint response (GET /api/analytics?days=N)
// ---------------------------------------------------------------------------

export interface AnalyticsOverview {
  total: number;
  human: number;
  search: number;
  ai: number;
  otherBot: number;
  totalDelta: number | null;
  humanDelta: number | null;
  searchDelta: number | null;
  aiDelta: number | null;
  otherBotDelta: number | null;
}

export interface AnalyticsDailyTrend {
  date: string; // YYYY-MM-DD
  human: number;
  search: number;
  ai: number;
  otherBot: number;
}

export interface AnalyticsAggregates {
  countries: { country: string; count: number }[];
  platforms: { os: string; count: number }[];
  browsers: { browser: string; count: number }[];
}

export interface AnalyticsPeriod {
  days: number;
  startDate: string; // YYYY-MM-DD, inclusive
  endDate: string; // YYYY-MM-DD, inclusive (yesterday)
}

export interface AnalyticsSummaryResponse {
  overview: AnalyticsOverview;
  daily: AnalyticsDailyTrend[];
  aggregates: AnalyticsAggregates;
  period: AnalyticsPeriod;
}

// ---------------------------------------------------------------------------
// Source detail endpoint response (GET /api/analytics/source?type=X&days=N)
// ---------------------------------------------------------------------------

export interface TopPageItem {
  path: string;
  title: string;
  isPost: boolean;
  views: number;
}

// --- Human ---

export interface HumanDetailResponse {
  type: "human";
  topPages: TopPageItem[];
  topReferrers: { referrer: string; views: number }[];
  devices: { deviceType: string; count: number }[];
  browsers: { browser: string; count: number }[];
  os: { os: string; count: number }[];
  countries: { country: string; count: number }[];
  recent24h: number;
}

// --- Search Engine ---

export interface SearchDetailResponse {
  type: "search";
  bots: { botName: string; count: number }[];
  topPages: TopPageItem[];
  dailyByBot: { date: string; botName: string; count: number }[];
  crawlerVsPage: {
    botName: string;
    path: string;
    title: string;
    count: number;
  }[];
}

// --- AI Bot ---

export interface AiBotDetailResponse {
  type: "ai";
  bots: { botName: string; count: number }[];
  topPages: TopPageItem[];
  dailyByBot: { date: string; botName: string; count: number }[];
}

// --- Other Bot ---

export interface OtherBotDetailResponse {
  type: "other";
  byCategory: { category: string; count: number }[];
  socialBots: { botName: string; count: number }[];
  monitorBots: { botName: string; count: number }[];
  unknownBots: { botName: string; userAgent: string; count: number }[];
}

export type SourceDetailResponse =
  | HumanDetailResponse
  | SearchDetailResponse
  | AiBotDetailResponse
  | OtherBotDetailResponse;
