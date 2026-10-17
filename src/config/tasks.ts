import type { ApiCreateTaskRequest, ApiTaskDto, ApiTaskRunDto } from '@/api';
import { formatClock, formatDateTime } from '@/utils/datetime';
import { parseCron, toCron, type CronPattern } from './cron';

export const TASK_SCHEDULE_KINDS = ['at', 'every', 'cron'] as const;

export type TaskScheduleKind = (typeof TASK_SCHEDULE_KINDS)[number];

export const MIN_TASK_EVERY_SECONDS = 60;

const GAP_UNITS: { key: string; seconds: number }[] = [
  { key: 'week', seconds: 7 * 24 * 60 * 60 },
  { key: 'day', seconds: 24 * 60 * 60 },
  { key: 'hour', seconds: 60 * 60 },
  { key: 'minute', seconds: 60 },
];

type Translate = (key: string, named?: Record<string, unknown>) => string;

export const TASK_RUN_STATUSES = ['running', 'ok', 'error', 'cancelled', 'skipped', 'lost'] as const;

export type TaskRunStatus = (typeof TASK_RUN_STATUSES)[number];

const RUN_STATUS_BADGES: Record<TaskRunStatus, string> = {
  running: 'badge-info',
  ok: 'badge-success',
  error: 'badge-error',
  cancelled: 'badge-ghost',
  skipped: 'badge-warning',
  lost: 'badge-error badge-outline',
};

export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function isTaskScheduleKind(value?: string): value is TaskScheduleKind {
  return value !== undefined && (TASK_SCHEDULE_KINDS as readonly string[]).includes(value);
}

export function isTaskRunStatus(value?: string): value is TaskRunStatus {
  return value !== undefined && (TASK_RUN_STATUSES as readonly string[]).includes(value);
}

export interface TaskRunStatusStyle {
  labelKey: string;
  badgeClass: string;
}

export function taskRunStatusStyle(status?: string): TaskRunStatusStyle {
  if (isTaskRunStatus(status)) {
    return { labelKey: `tasks.runStatus.${status}`, badgeClass: RUN_STATUS_BADGES[status] };
  }
  return { labelKey: '', badgeClass: 'badge-ghost' };
}

export interface TaskScheduleForm {
  kind: TaskScheduleKind;
  runAt: string;
  everyMinutes: number;
  pattern: CronPattern;
  timezone: string;
}

export const DEFAULT_CRON_PATTERN: CronPattern = { type: 'daily', hour: 9, minute: 0 };

export function emptyTaskSchedule(): TaskScheduleForm {
  return {
    kind: 'cron',
    runAt: '',
    everyMinutes: 60,
    pattern: { ...DEFAULT_CRON_PATTERN },
    timezone: browserTimeZone(),
  };
}

export function taskScheduleForm(task: ApiTaskDto): TaskScheduleForm {
  const form = emptyTaskSchedule();
  if (isTaskScheduleKind(task.schedule_kind)) {
    form.kind = task.schedule_kind;
  }
  form.runAt = toDateTimeLocal(task.run_at);
  form.everyMinutes = Math.max(Math.round((task.every_seconds ?? MIN_TASK_EVERY_SECONDS) / 60), 1);
  form.pattern = task.cron_expr?.trim() ? parseCron(task.cron_expr) : form.pattern;
  form.timezone = task.timezone || form.timezone;
  return form;
}

export function toDateTimeLocal(iso?: string): string {
  if (!iso) {
    return '';
  }
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) {
    return '';
  }
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

export function fromDateTimeLocal(value: string): string {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? '' : at.toISOString();
}

export type TaskScheduleBody = Pick<ApiCreateTaskRequest, 'schedule_kind' | 'run_at' | 'every_seconds' | 'cron_expr' | 'timezone'>;

export function taskScheduleBody(form: TaskScheduleForm): TaskScheduleBody {
  const body: TaskScheduleBody = { schedule_kind: form.kind };

  if (form.kind === 'at') {
    body.run_at = fromDateTimeLocal(form.runAt);
  }
  if (form.kind === 'every') {
    body.every_seconds = Math.round(form.everyMinutes * 60);
  }
  if (form.kind === 'cron') {
    body.cron_expr = toCron(form.pattern);
    body.timezone = form.timezone.trim() || 'UTC';
  }
  return body;
}

export function gapLabel(seconds: number, t: Translate): string {
  const unit = GAP_UNITS.find((candidate) => seconds >= candidate.seconds && seconds % candidate.seconds === 0);
  if (!unit) {
    return t('tasks.gap.second', { count: seconds });
  }
  return t(`tasks.gap.${unit.key}`, { count: seconds / unit.seconds });
}

export function cronSummary(expr: string, t: Translate): string {
  const pattern = parseCron(expr);

  switch (pattern.type) {
    case 'daily':
      return t('tasks.cronDaily', { time: formatClock(pattern.hour, pattern.minute) });
    case 'weekdays':
      return t('tasks.cronWeekdays', { time: formatClock(pattern.hour, pattern.minute) });
    case 'weekly':
      return t('tasks.cronWeekly', { day: t(`tasks.weekday.${pattern.weekday}`), time: formatClock(pattern.hour, pattern.minute) });
    case 'monthly':
      return t('tasks.cronMonthly', { day: pattern.dayOfMonth, time: formatClock(pattern.hour, pattern.minute) });
    case 'custom':
      return pattern.expr;
  }
}

export function taskScheduleSummary(task: ApiTaskDto, t: Translate): string {
  if (task.schedule_kind === 'at') {
    return t('tasks.at', { time: formatDateTime(task.run_at) });
  }
  if (task.schedule_kind === 'every') {
    return t('tasks.every', { gap: gapLabel(task.every_seconds ?? MIN_TASK_EVERY_SECONDS, t) });
  }
  if (task.schedule_kind === 'cron') {
    return t('tasks.cron', { schedule: cronSummary(task.cron_expr ?? '', t), timezone: task.timezone ?? 'UTC' });
  }
  return task.schedule_kind ?? '';
}

export function taskTriggerLabel(trigger: string | undefined, t: Translate): string {
  if (trigger === 'manual') {
    return t('tasks.triggerManual');
  }
  if (trigger === 'schedule') {
    return t('tasks.triggerSchedule');
  }
  return trigger ?? '';
}

/**
 * How long a run took, from its start to its finish.
 *
 * A run that has not finished has no duration to state — reporting the time
 * elapsed so far would be a number that changes under the reader, and it would
 * read as a finished figure. The caller shows the status instead.
 */
export function formatDuration(run: ApiTaskRunDto): string {
  if (!run.started_at) {
    return '';
  }
  const finished = run.finished_at ? new Date(run.finished_at).getTime() : Number.NaN;
  const started = new Date(run.started_at).getTime();
  if (Number.isNaN(finished) || Number.isNaN(started) || finished < started) {
    return '';
  }

  const seconds = (finished - started) / 1000;
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)} ms`;
  }
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }

  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  if (minutes < 60) {
    return `${minutes}m ${rest}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
