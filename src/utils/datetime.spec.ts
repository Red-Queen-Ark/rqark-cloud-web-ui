import { describe, expect, it } from 'vitest';
import { DATE_TIME_FALLBACK, formatClock, formatDateTime } from './datetime';

describe('formatDateTime', () => {
  it('renders YYYY-MM-DD HH:MM:SS in local time', () => {
    const local = new Date(2026, 3, 5, 14, 7, 8);
    expect(formatDateTime(local.toISOString())).toBe('2026-04-05 14:07:08');
  });

  it('zero-pads every part', () => {
    const local = new Date(2026, 0, 2, 3, 4, 5);
    expect(formatDateTime(local.toISOString())).toBe('2026-01-02 03:04:05');
  });

  it('keeps seconds and drops sub-second precision', () => {
    const local = new Date(2026, 3, 5, 14, 7, 8, 999);
    expect(formatDateTime(local.toISOString())).toBe('2026-04-05 14:07:08');
  });

  it.each([undefined, null, '', 'not-a-date'])('falls back for %s', (value) => {
    expect(formatDateTime(value)).toBe(DATE_TIME_FALLBACK);
  });
});

describe('formatClock', () => {
  it('renders a time of day as 24-hour HH:MM', () => {
    expect(formatClock(9, 0)).toBe('09:00');
    expect(formatClock(0, 5)).toBe('00:05');
    expect(formatClock(23, 59)).toBe('23:59');
  });
});
