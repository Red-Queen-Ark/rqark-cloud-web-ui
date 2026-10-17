import { describe, expect, it } from 'vitest';
import { parseCron, toCron } from './cron';
import { emptyTaskSchedule, formatDuration, fromDateTimeLocal, gapLabel, isTaskScheduleKind, taskRunStatusStyle, taskScheduleBody, taskScheduleForm, taskScheduleSummary, taskTriggerLabel, toDateTimeLocal } from './tasks';

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

describe('taskRunStatusStyle', () => {
  it('gives every status its own badge and label', () => {
    const statuses = ['running', 'ok', 'error', 'cancelled', 'skipped', 'lost'];
    const styles = statuses.map((status) => taskRunStatusStyle(status));

    expect(styles.map((style) => style.labelKey)).toEqual(statuses.map((status) => `tasks.runStatus.${status}`));
    expect(new Set(styles.map((style) => style.badgeClass)).size).toBe(statuses.length);
  });

  it.each([undefined, '', 'awaiting_review'])('falls back for %s without claiming a known label', (status) => {
    expect(taskRunStatusStyle(status).labelKey).toBe('');
  });
});

describe('taskTriggerLabel', () => {
  it('names the two triggers and passes anything else through', () => {
    expect(taskTriggerLabel('schedule', translate)).toContain('tasks.triggerSchedule');
    expect(taskTriggerLabel('manual', translate)).toContain('tasks.triggerManual');
    expect(taskTriggerLabel('later', translate)).toBe('later');
    expect(taskTriggerLabel(undefined, translate)).toBe('');
  });
});

describe('formatDuration', () => {
  it('states a finished run to a tenth of a second, then in minutes and hours', () => {
    expect(formatDuration({ started_at: '2026-10-17T01:00:00Z', finished_at: '2026-10-17T01:00:12Z' })).toBe('12.0 s');
    expect(formatDuration({ started_at: '2026-10-17T01:00:00Z', finished_at: '2026-10-17T01:01:30Z' })).toBe('1m 30s');
    expect(formatDuration({ started_at: '2026-10-17T01:00:00Z', finished_at: '2026-10-17T03:30:00Z' })).toBe('2h 30m');
  });

  it('states a sub-second run in milliseconds rather than rounding it to zero', () => {
    expect(formatDuration({ started_at: '2026-10-17T01:00:00Z', finished_at: '2026-10-17T01:00:00.250Z' })).toBe('250 ms');
  });

  it('states nothing while a run is unfinished', () => {
    expect(formatDuration({ started_at: '2026-10-17T01:00:00Z' })).toBe('');
  });

  it('states nothing for a missing start or an impossible interval', () => {
    expect(formatDuration({ finished_at: '2026-10-17T01:00:12Z' })).toBe('');
    expect(formatDuration({ started_at: '2026-10-17T01:00:12Z', finished_at: '2026-10-17T01:00:00Z' })).toBe('');
    expect(formatDuration({ started_at: 'not-a-date', finished_at: '2026-10-17T01:00:12Z' })).toBe('');
  });
});
