#!/usr/bin/env bun
/** Read Cloudflare analytics; never query or write the application database. */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";

const HALF_HOUR = 30 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const METRICS = ["readQueries", "writeQueries", "rowsRead", "rowsWritten"] as const;
type Usage = Record<(typeof METRICS)[number], number>;
type Group = { dimensions: { date?: string; datetimeFifteenMinutes?: string }; sum: Usage };

interface Config {
  accountId: string;
  databaseId: string;
  baselineStart: string;
  baselineEnd: string; // exclusive, complete UTC days only
  deployedAt?: string;
  migrationStartedAt?: string;
  migrationCompletedAt?: string;
}

export function halfHours(groups: Group[]) {
  const buckets = new Map<string, Usage>();
  for (const group of groups) {
    if (!group.dimensions.datetimeFifteenMinutes) continue;
    const date = new Date(Math.floor(Date.parse(group.dimensions.datetimeFifteenMinutes) / HALF_HOUR) * HALF_HOUR).toISOString();
    const usage = buckets.get(date) ?? { readQueries: 0, writeQueries: 0, rowsRead: 0, rowsWritten: 0 };
    for (const metric of METRICS) usage[metric] += group.sum[metric];
    buckets.set(date, usage);
  }
  return [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([start, usage]) => ({ start, ...usage }));
}

export function completePostDays(groups: Group[], deployedAt: string | undefined, today: string) {
  if (!deployedAt) return [];
  const releaseDay = deployedAt.slice(0, 10);
  return groups.filter(({ dimensions: { date } }) => date && date > releaseDay && date < today);
}

function mean(groups: Group[], metric: keyof Usage): number {
  return groups.reduce((sum, group) => sum + group.sum[metric], 0) / groups.length;
}

function save(path: string, value: unknown) {
  writeFileSync(`${path}.tmp`, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(`${path}.tmp`, path);
}

export async function sample(stateDir: string) {
  const config: Config = JSON.parse(readFileSync(join(stateDir, "config.json"), "utf8"));
  if (!config.accountId || !config.databaseId) throw new Error("Monitoring account/database is not configured");
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  // Skip at least 30 minutes of recent data to allow analytics ingestion.
  // Re-read 48 hours each time so late arrivals are visible in later snapshots.
  const intervalEnd = Math.floor((now.getTime() - HALF_HOUR) / HALF_HOUR) * HALF_HOUR;
  const variables = {
    account: config.accountId, database: config.databaseId,
    dailyStart: new Date(now.getTime() - 30 * DAY).toISOString().slice(0, 10), today,
    start: new Date(intervalEnd - 2 * DAY).toISOString(), end: new Date(intervalEnd).toISOString(),
  };

  // Wrangler refreshes its own OAuth session. Do not copy tokens into config,
  // logs, launchd plists or GitHub. A neutral cwd avoids project dotenv tokens.
  const wrangler = resolve(import.meta.dirname, "../worker/node_modules/.bin/wrangler");
  const auth = JSON.parse(execFileSync(wrangler, ["auth", "token", "--json"], {
    cwd: stateDir, encoding: "utf8", timeout: 45_000,
    env: { PATH: process.env.PATH, HOME: homedir(), TMPDIR: process.env.TMPDIR, WRANGLER_SEND_METRICS: "false" },
    stdio: ["ignore", "pipe", "ignore"],
  }));
  if (!auth.token) throw new Error("Wrangler authentication unavailable");

  const query = `query($account: string, $database: string, $dailyStart: Date, $today: Date, $start: Time, $end: Time) {
    viewer { accounts(filter: {accountTag: $account}) {
      daily: d1AnalyticsAdaptiveGroups(limit: 100, filter: {databaseId: $database, date_geq: $dailyStart, date_leq: $today}, orderBy: [date_ASC]) {
        dimensions {date} sum {readQueries writeQueries rowsRead rowsWritten}
      }
      intervals: d1AnalyticsAdaptiveGroups(limit: 1000, filter: {databaseId: $database, datetime_geq: $start, datetime_lt: $end}, orderBy: [datetimeFifteenMinutes_ASC]) {
        dimensions {datetimeFifteenMinutes} sum {readQueries writeQueries rowsRead rowsWritten}
      }
      storage: d1StorageAdaptiveGroups(limit: 100, filter: {databaseId: $database, date_geq: $dailyStart, date_leq: $today}, orderBy: [date_ASC]) {
        dimensions {date} max {databaseSizeBytes}
      }
    } }
  }`;
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST", headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(45_000),
  });
  const body = await response.json() as {
    errors?: { message: string }[];
    data?: { viewer: { accounts: { daily: Group[]; intervals: Group[]; storage: { dimensions: { date: string }; max: { databaseSizeBytes: number } }[] }[] } };
  };
  if (!response.ok || body.errors?.length) throw new Error(`Cloudflare analytics: HTTP ${response.status}; ${body.errors?.map((error) => error.message).join(", ") ?? "request failed"}`);
  const data = body.data?.viewer.accounts[0];
  if (!data?.daily.length) throw new Error("Cloudflare returned no database usage; refusing to report zero");

  const baselinePath = join(stateDir, "baseline.json");
  if (!existsSync(baselinePath)) {
    const days = data.daily.filter(({ dimensions: { date } }) => date && date >= config.baselineStart && date < config.baselineEnd && date < today);
    const expectedDays = (Date.parse(config.baselineEnd) - Date.parse(config.baselineStart)) / DAY;
    if (days.length !== expectedDays || days.length < 3) throw new Error("Incomplete baseline; use at least 3 complete UTC days");
    save(baselinePath, { capturedAt: now.toISOString(), days });
  }
  const baseline: { days: Group[] } = JSON.parse(readFileSync(baselinePath, "utf8"));
  const after = completePostDays(data.daily, config.deployedAt, today);
  const monthlyCost = (days: Group[]) => 30 * (mean(days, "rowsRead") / 1e9 + mean(days, "rowsWritten") / 1e6);
  const storage = data.storage.at(-1);
  const intervals = halfHours(data.intervals).map((bucket) => ({
    ...bucket,
    phase: !config.deployedAt || Date.parse(bucket.start) < Date.parse(config.deployedAt)
      ? "before-or-rollout" : "after",
    migration: !!config.migrationStartedAt && Date.parse(bucket.start) + HALF_HOUR > Date.parse(config.migrationStartedAt)
      && (!config.migrationCompletedAt || Date.parse(bucket.start) <= Date.parse(config.migrationCompletedAt)),
  }));
  const captured = { capturedAt: now.toISOString(), databaseId: config.databaseId, intervalEnd: variables.end, ...data, halfHours: intervals };
  const snapshotDir = join(stateDir, "samples", today);
  mkdirSync(snapshotDir, { recursive: true, mode: 0o700 });
  save(join(snapshotDir, `${now.toISOString().slice(11, 19).replaceAll(":", "")}.json`), captured);
  save(join(stateDir, "latest.json"), captured);

  const labels = ["读取 SQL 次数", "写入 SQL 次数", "读取行数", "写入行数"];
  const lines = [
    "# Firefly D1 用量监控", "",
    `采样：${now.toISOString()}；数据库：${config.databaseId}。每 30 分钟采样，最新统计截止 ${variables.end}。`, "",
    `基线：${config.baselineStart} 至 ${config.baselineEnd}（不含），${baseline.days.length} 个完整 UTC 日。`,
    `上线：${config.deployedAt ?? "尚未记录"}；已有 ${after.length} 个完整上线后 UTC 日。`, "",
    `存储：${storage ? `${(storage.max.databaseSizeBytes / 1e6).toFixed(2)} MB（${storage.dimensions.date} 最大值）` : "待平台指标"}。`, "",
    "| 指标 | 基线日均 | 上线后日均 | 降幅 |", "| --- | ---: | ---: | ---: |",
    ...METRICS.map((metric, i) => {
      const before = mean(baseline.days, metric);
      const current = after.length ? mean(after, metric) : undefined;
      const saving = after.length >= 3 && current !== undefined && before > 0 ? `${((1 - current / before) * 100).toFixed(1)}%` : "待至少 3 个完整日";
      return `| ${labels[i]} | ${Math.round(before).toLocaleString("en-US")} | ${current === undefined ? "待采样" : Math.round(current).toLocaleString("en-US")} | ${saving} |`;
    }), "",
    `按 D1 超额单价折算 30 天读写费用：基线 $${monthlyCost(baseline.days).toFixed(3)}；${after.length >= 3 ? `上线后 $${monthlyCost(after).toFixed(3)}，差额 $${(monthlyCost(baseline.days) - monthlyCost(after)).toFixed(3)}` : "上线后待至少 3 个完整日"}。仅边际读写成本估算，未扣账号免费额度、不含存储和 Worker 费用，不是账单。`, "",
    "最近半小时区间（UTC；平台统计可能延迟，缺失区间不当作 0）：", "",
    "| 起点 | 读取 SQL | 写入 SQL | 读取行 | 写入行 | 阶段 |",
    "| --- | ---: | ---: | ---: | ---: | --- |",
    ...intervals.slice(-8).map((bucket) => `| ${bucket.start} | ${bucket.readQueries} | ${bucket.writeQueries} | ${bucket.rowsRead} | ${bucket.rowsWritten} | ${bucket.migration ? "索引迁移" : bucket.phase} |`), "",
    "上线当日和迁移消耗不参与完整日对比。全库变化包含流量、后台操作等因素，不能直接当作缓存命中率或账单节省比例。", "",
    "本任务通过 Cloudflare Analytics API 读取指标，不向 D1 写监控记录。由本机 launchd 调度；电脑休眠、关机或 OAuth 失效会中断采样，恢复后补读最近 48 小时。", "",
  ];
  writeFileSync(join(stateDir, "report.md"), lines.join("\n"), { mode: 0o600 });
  save(join(stateDir, "status.json"), { ok: true, sampledAt: now.toISOString(), intervalEnd: variables.end });
  console.log(JSON.stringify({ sampledAt: now.toISOString(), intervalEnd: variables.end, intervals: intervals.length, postReleaseDays: after.length }));
}

if (import.meta.main) {
  const stateDir = resolve(process.argv[2] ?? join(homedir(), "Library/Application Support/Firefly/d1-monitor"));
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  try {
    await sample(stateDir);
  } catch (error) {
    // execFileSync errors can carry captured stdout; never serialize the error
    // object because authentication output contains a bearer token.
    const message = error instanceof Error && "stdout" in error ? "Wrangler authentication failed" : String(error);
    save(join(stateDir, "status.json"), { ok: false, failedAt: new Date().toISOString(), error: message });
    console.error(message);
    process.exitCode = 1;
  }
}
