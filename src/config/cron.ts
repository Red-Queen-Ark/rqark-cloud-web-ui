export type CronPattern =
  | { type: 'daily'; hour: number; minute: number }
  | { type: 'weekdays'; hour: number; minute: number }
  | { type: 'weekly'; hour: number; minute: number; weekday: number }
  | { type: 'monthly'; hour: number; minute: number; dayOfMonth: number }
  | { type: 'custom'; expr: string };

export const CRON_PATTERN_TYPES = ['daily', 'weekdays', 'weekly', 'monthly', 'custom'] as const;

export const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0] as const;

const NUMERIC = /^\d{1,2}$/;

function isNumber(value: string): boolean {
  return NUMERIC.test(value);
}

export function toCron(pattern: CronPattern): string {
  switch (pattern.type) {
    case 'daily':
      return `${pattern.minute} ${pattern.hour} * * *`;
    case 'weekdays':
      return `${pattern.minute} ${pattern.hour} * * 1-5`;
    case 'weekly':
      return `${pattern.minute} ${pattern.hour} * * ${pattern.weekday}`;
    case 'monthly':
      return `${pattern.minute} ${pattern.hour} ${pattern.dayOfMonth} * *`;
    case 'custom':
      return pattern.expr.trim();
  }
}

export function parseCron(expr: string): CronPattern {
  const trimmed = expr.trim();
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) {
    return { type: 'custom', expr: trimmed };
  }

  const [minute, hour, dayOfMonth, month, weekday] = fields;
  const custom: CronPattern = { type: 'custom', expr: trimmed };
  if (!isNumber(minute) || !isNumber(hour) || month !== '*') {
    return custom;
  }

  const at = { hour: Number(hour), minute: Number(minute) };
  if (Number(hour) > 23 || Number(minute) > 59) {
    return custom;
  }

  if (dayOfMonth === '*') {
    if (weekday === '*') {
      return { type: 'daily', ...at };
    }
    if (weekday === '1-5') {
      return { type: 'weekdays', ...at };
    }
    if (isNumber(weekday) && Number(weekday) <= 6) {
      return { type: 'weekly', ...at, weekday: Number(weekday) };
    }
    return custom;
  }

  if (weekday === '*' && isNumber(dayOfMonth) && Number(dayOfMonth) >= 1 && Number(dayOfMonth) <= 31) {
    return { type: 'monthly', ...at, dayOfMonth: Number(dayOfMonth) };
  }

  return custom;
}

export function hours(): number[] {
  return Array.from({ length: 24 }, (_, index) => index);
}

export function minutes(): number[] {
  return Array.from({ length: 60 }, (_, index) => index);
}

export function daysOfMonth(): number[] {
  return Array.from({ length: 31 }, (_, index) => index + 1);
}

export function padTime(value: number): string {
  return String(value).padStart(2, '0');
}
