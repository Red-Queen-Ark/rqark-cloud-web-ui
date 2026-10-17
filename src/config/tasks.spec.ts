import { describe, expect, it } from 'vitest';
import { parseCron, toCron } from './cron';
import { emptyTaskSchedule, fromDateTimeLocal, gapLabel, isTaskScheduleKind, taskScheduleBody, taskScheduleForm, taskScheduleSummary, toDateTimeLocal } from './tasks';

const translate = (key: string, named?: Record<string, unknown>) => `${key}:${JSON.stringify(named ?? {})}`;

describe('isTaskScheduleKind', () => {
  it.each(['at', 'every', 'cron'])('accepts %s', (kind) => {
    expect(isTaskScheduleKind(kind)).toBe(true);
  });

  it.each([undefined, '', 'later', 'toString'])('rejects %s', (kind) => {
    expect(isTaskScheduleKind(kind)).toBe(false);
  });
});

describe('cron patterns', () => {
  it('writes each friendly pattern as five plain fields', () => {
    expect(toCron({ type: 'daily', hour: 9, minute: 0 })).toBe('0 9 * * *');
    expect(toCron({ type: 'weekdays', hour: 9, minute: 30 })).toBe('30 9 * * 1-5');
    expect(toCron({ type: 'weekly', hour: 9, minute: 0, weekday: 3 })).toBe('0 9 * * 3');
    expect(toCron({ type: 'monthly', hour: 9, minute: 0, dayOfMonth: 15 })).toBe('0 9 15 * *');
    expect(toCron({ type: 'custom', expr: '  */5 * * * * ' })).toBe('*/5 * * * *');
  });

  it('reads those expressions back into the pattern they came from', () => {
    expect(parseCron('0 9 * * *')).toEqual({ type: 'daily', hour: 9, minute: 0 });
    expect(parseCron('30 9 * * 1-5')).toEqual({ type: 'weekdays', hour: 9, minute: 30 });
    expect(parseCron('0 9 * * 0')).toEqual({ type: 'weekly', hour: 9, minute: 0, weekday: 0 });
    expect(parseCron('0 9 15 * *')).toEqual({ type: 'monthly', hour: 9, minute: 0, dayOfMonth: 15 });
  });

  it.each(['*/5 * * * *', '0 9 * * 1,3', '0 9 1 6 *', '0 9 * *', ''])('keeps %s as a custom expression', (expr) => {
    expect(parseCron(expr)).toEqual({ type: 'custom', expr: expr.trim() });
  });

  it('does not mistake an out-of-range field for a friendly pattern', () => {
    expect(parseCron('0 25 * * *')).toEqual({ type: 'custom', expr: '0 25 * * *' });
    expect(parseCron('0 9 * * 9')).toEqual({ type: 'custom', expr: '0 9 * * 9' });
  });
});

describe('taskScheduleForm', () => {
  it('reads a stored cron task into the friendly controls', () => {
    const form = taskScheduleForm({ schedule_kind: 'cron', cron_expr: '0 9 * * 1-5', timezone: 'Asia/Hong_Kong' });

    expect(form).toMatchObject({ kind: 'cron', pattern: { type: 'weekdays', hour: 9, minute: 0 }, timezone: 'Asia/Hong_Kong' });
  });

  it('turns a stored every gap into minutes, never below one', () => {
    expect(taskScheduleForm({ schedule_kind: 'every', every_seconds: 5400 }).everyMinutes).toBe(90);
    expect(taskScheduleForm({ schedule_kind: 'every', every_seconds: 30 }).everyMinutes).toBe(1);
  });

  it('falls back to a daily schedule for a kind this build does not know', () => {
    expect(taskScheduleForm({ schedule_kind: 'later' }).pattern).toEqual(emptyTaskSchedule().pattern);
  });
});

describe('taskScheduleBody', () => {
  it('sends only the field its kind uses', () => {
    const cron = taskScheduleBody({ ...emptyTaskSchedule(), kind: 'cron', pattern: { type: 'daily', hour: 9, minute: 0 }, timezone: 'UTC' });
    expect(cron).toEqual({ schedule_kind: 'cron', cron_expr: '0 9 * * *', timezone: 'UTC' });

    const every = taskScheduleBody({ ...emptyTaskSchedule(), kind: 'every', everyMinutes: 90 });
    expect(every).toEqual({ schedule_kind: 'every', every_seconds: 5400 });

    const at = taskScheduleBody({ ...emptyTaskSchedule(), kind: 'at', runAt: '2026-10-18T09:00' });
    expect(at.schedule_kind).toBe('at');
    expect(new Date(at.run_at as string).getTime()).toBe(new Date('2026-10-18T09:00').getTime());
    expect(at).not.toHaveProperty('cron_expr');
  });

  it('falls back to UTC for an empty cron timezone', () => {
    expect(taskScheduleBody({ ...emptyTaskSchedule(), kind: 'cron', timezone: '  ' }).timezone).toBe('UTC');
  });
});

describe('toDateTimeLocal', () => {
  it('renders a local wall clock, and nothing for a missing or invalid instant', () => {
    const local = new Date(2026, 9, 18, 9, 5);
    expect(toDateTimeLocal(local.toISOString())).toBe('2026-10-18T09:05');
    expect(toDateTimeLocal(undefined)).toBe('');
    expect(toDateTimeLocal('not-a-date')).toBe('');
    expect(fromDateTimeLocal('')).toBe('');
  });
});

describe('gapLabel', () => {
  it.each([
    [7 * 24 * 60 * 60, 'tasks.gap.week'],
    [24 * 60 * 60, 'tasks.gap.day'],
    [3600, 'tasks.gap.hour'],
    [300, 'tasks.gap.minute'],
  ])('labels %i seconds in a whole unit', (seconds, key) => {
    expect(gapLabel(seconds, translate)).toContain(`${key}:`);
  });

  it('keeps seconds for an odd gap', () => {
    expect(gapLabel(90, translate)).toContain('tasks.gap.second:');
  });
});

describe('taskScheduleSummary', () => {
  it('names a cron schedule in words rather than in fields', () => {
    const summary = taskScheduleSummary({ schedule_kind: 'cron', cron_expr: '0 9 * * 1-5', timezone: 'Asia/Hong_Kong' }, translate);

    expect(summary).toContain('tasks.cron:');
    expect(summary).toContain('tasks.cronWeekdays:');
    expect(summary).toContain('Asia/Hong_Kong');
  });

  it('keeps a custom expression as it is', () => {
    expect(taskScheduleSummary({ schedule_kind: 'cron', cron_expr: '*/5 * * * *' }, translate)).toContain('*/5 * * * *');
  });

  it('names the other two kinds in their own words', () => {
    expect(taskScheduleSummary({ schedule_kind: 'every', every_seconds: 3600 }, translate)).toContain('tasks.every:');
    expect(taskScheduleSummary({ schedule_kind: 'at', run_at: '2026-10-18T09:00:00Z' }, translate)).toContain('tasks.at:');
  });

  it('shows the raw kind for one this build does not know', () => {
    expect(taskScheduleSummary({ schedule_kind: 'later' }, translate)).toBe('later');
  });
});
