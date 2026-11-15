import { describe, expect, it } from 'vitest';
import { bucketUsage, dateInputValue, formatPercent, formatTokens, parseDateInput, rangeFor, rangeFromDates, summarize } from './usage';
import type { ApiUsageLogDto } from '@/api';

const NOW = new Date(2026, 10, 15, 10, 30, 0);

function at(day: number, hour = 12): string {
  return new Date(2026, 10, day, hour, 0, 0).toISOString();
}

describe('rangeFor', () => {
  it('covers today only', () => {
    const range = rangeFor('today', NOW);
    expect(range.from.getTime()).toBe(new Date(2026, 10, 15).getTime());
    expect(range.to.getTime()).toBe(new Date(2026, 10, 16).getTime());
  });

  it('ends yesterday before today starts', () => {
    const range = rangeFor('yesterday', NOW);
    expect(range.from.getTime()).toBe(new Date(2026, 10, 14).getTime());
    expect(range.to.getTime()).toBe(new Date(2026, 10, 15).getTime());
  });

  it('counts the last 7 days up to and including today', () => {
    const range = rangeFor('last7', NOW);
    expect(range.from.getTime()).toBe(new Date(2026, 10, 9).getTime());
    expect(range.to.getTime()).toBe(new Date(2026, 10, 16).getTime());
  });

  it('starts at the first of the month', () => {
    const range = rangeFor('thisMonth', NOW);
    expect(range.from.getTime()).toBe(new Date(2026, 10, 1).getTime());
    expect(range.to.getTime()).toBe(new Date(2026, 10, 16).getTime());
  });

  it('covers the whole previous month across a year boundary', () => {
    const range = rangeFor('lastMonth', new Date(2026, 0, 10));
    expect(range.from.getTime()).toBe(new Date(2025, 11, 1).getTime());
    expect(range.to.getTime()).toBe(new Date(2026, 0, 1).getTime());
  });
});

describe('bucketUsage', () => {
  const rows: ApiUsageLogDto[] = [
    { created_at: at(14), prompt_tokens: 100, completion_tokens: 20, cached_tokens: 60 },
    { created_at: at(15), prompt_tokens: 50, completion_tokens: 5, total_tokens: 55, cached_tokens: 40 },
    { created_at: at(15, 18), prompt_tokens: 1, completion_tokens: 1 },
    { created_at: at(9), prompt_tokens: 999, completion_tokens: 999 },
  ];

  it('makes one bucket per day of the range, empty days included', () => {
    const buckets = bucketUsage(rows, rangeFromDates(new Date(2026, 10, 13), new Date(2026, 10, 15)));
    expect(buckets.map((bucket) => bucket.date)).toEqual(['2026-11-13', '2026-11-14', '2026-11-15']);
    expect(buckets.map((bucket) => bucket.label)).toEqual(['11/13', '11/14', '11/15']);
  });

  it('adds the rows of a day and drops the ones outside the range', () => {
    const buckets = bucketUsage(rows, rangeFromDates(new Date(2026, 10, 14), new Date(2026, 10, 15)));
    const byDate = Object.fromEntries(buckets.map((bucket) => [bucket.date, bucket]));

    expect(byDate['2026-11-14']).toMatchObject({ promptTokens: 100, completionTokens: 20, cachedTokens: 60, totalTokens: 120, requests: 1 });
    expect(byDate['2026-11-15']).toMatchObject({ promptTokens: 51, completionTokens: 6, cachedTokens: 40, totalTokens: 57, requests: 2 });
    expect(buckets.some((bucket) => bucket.date === '2026-11-09')).toBe(false);
  });

  it('falls back to prompt plus completion when the row carries no total', () => {
    const buckets = bucketUsage([{ created_at: at(15), prompt_tokens: 7, completion_tokens: 3 }], rangeFor('today', NOW));
    expect(buckets.at(-1)?.totalTokens).toBe(10);
  });
});

describe('summarize', () => {
  it('adds every row once', () => {
    const summary = summarize([{ prompt_tokens: 10, completion_tokens: 2, cached_tokens: 8 }, { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 }, { total_tokens: 3 }]);
    expect(summary).toEqual({ requests: 3, promptTokens: 15, completionTokens: 7, cachedTokens: 8, totalTokens: 25 });
  });
});

describe('formatTokens', () => {
  it('groups thousands without following the machine locale', () => {
    expect(formatTokens(648898993)).toBe('648,898,993');
    expect(formatTokens(0)).toBe('0');
  });
});

describe('formatPercent', () => {
  it('shows one decimal place', () => {
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(0.8333)).toBe('83.3%');
    expect(formatPercent(1)).toBe('100.0%');
  });
});

describe('date inputs', () => {
  it('round-trips a local date', () => {
    const date = new Date(2026, 10, 5);
    expect(dateInputValue(date)).toBe('2026-11-05');
    expect(parseDateInput('2026-11-05')?.getTime()).toBe(date.getTime());
  });

  it('rejects a value that is not a date', () => {
    expect(parseDateInput('')).toBeUndefined();
    expect(parseDateInput('5 Nov')).toBeUndefined();
  });
});
