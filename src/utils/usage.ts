import type { ApiUsageLogDto } from '@/api';

export type UsageRangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom';

export const USAGE_RANGE_PRESETS: UsageRangePreset[] = ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'lastMonth', 'custom'];

export interface UsageRange {
  from: Date;
  to: Date;
}

export interface UsageBucket {
  date: string;
  label: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
  requests: number;
}

export interface UsageSummary {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
}

const MAX_BUCKETS = 366;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function rangeFor(preset: Exclude<UsageRangePreset, 'custom'>, now: Date = new Date()): UsageRange {
  const today = startOfDay(now);

  switch (preset) {
    case 'yesterday':
      return { from: addDays(today, -1), to: today };
    case 'last7':
      return { from: addDays(today, -6), to: addDays(today, 1) };
    case 'last30':
      return { from: addDays(today, -29), to: addDays(today, 1) };
    case 'thisMonth':
      return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: addDays(today, 1) };
    case 'lastMonth':
      return { from: new Date(today.getFullYear(), today.getMonth() - 1, 1), to: new Date(today.getFullYear(), today.getMonth(), 1) };
    default:
      return { from: today, to: addDays(today, 1) };
  }
}

export function rangeFromDates(from: Date, to: Date): UsageRange {
  return { from: startOfDay(from), to: addDays(startOfDay(to), 1) };
}

export function dateKey(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dayLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function tokensOf(row: ApiUsageLogDto): { prompt: number; completion: number; cached: number; total: number } {
  const prompt = row.prompt_tokens ?? 0;
  const completion = row.completion_tokens ?? 0;
  return { prompt, completion, cached: row.cached_tokens ?? 0, total: row.total_tokens ?? prompt + completion };
}

export function bucketUsage(rows: ApiUsageLogDto[], range: UsageRange): UsageBucket[] {
  const buckets = new Map<string, UsageBucket>();
  let cursor = startOfDay(range.from);

  while (cursor < range.to && buckets.size < MAX_BUCKETS) {
    buckets.set(dateKey(cursor), {
      date: dateKey(cursor),
      label: dayLabel(cursor),
      promptTokens: 0,
      completionTokens: 0,
      cachedTokens: 0,
      totalTokens: 0,
      requests: 0,
    });
    cursor = addDays(cursor, 1);
  }

  for (const row of rows) {
    if (!row.created_at) {
      continue;
    }
    const at = new Date(row.created_at);
    if (Number.isNaN(at.getTime()) || at < range.from || at >= range.to) {
      continue;
    }
    const bucket = buckets.get(dateKey(at));
    if (!bucket) {
      continue;
    }
    const tokens = tokensOf(row);
    bucket.promptTokens += tokens.prompt;
    bucket.completionTokens += tokens.completion;
    bucket.cachedTokens += tokens.cached;
    bucket.totalTokens += tokens.total;
    bucket.requests += 1;
  }

  return [...buckets.values()];
}

export function summarize(rows: ApiUsageLogDto[]): UsageSummary {
  return rows.reduce<UsageSummary>(
    (summary, row) => {
      const tokens = tokensOf(row);
      summary.requests += 1;
      summary.promptTokens += tokens.prompt;
      summary.completionTokens += tokens.completion;
      summary.cachedTokens += tokens.cached;
      summary.totalTokens += tokens.total;
      return summary;
    },
    { requests: 0, promptTokens: 0, completionTokens: 0, cachedTokens: 0, totalTokens: 0 },
  );
}

export function formatTokens(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

export function parseDateInput(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return undefined;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function dateInputValue(date: Date): string {
  return dateKey(date);
}
