/**
 * Shared date/time rendering helpers.
 *
 * The UI must show timestamps in a single, unambiguous shape: `YYYY-MM-DD HH:MM:SS`
 * (local time, seconds included). Never call `toLocaleDateString()` / `toLocaleTimeString()`
 * directly in components — they drop the time part or vary with the machine locale.
 */

export const DATE_TIME_FALLBACK = '—';

const DATE_SEPARATOR = '-';
const TIME_SEPARATOR = ':';
const DATE_TIME_SEPARATOR = ' ';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Renders a date as `YYYY-MM-DD HH:MM:SS` in local time, or `—` when missing/invalid. */
export function formatDateTime(value?: string | null): string {
  if (!value) {
    return DATE_TIME_FALLBACK;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return DATE_TIME_FALLBACK;
  }

  const datePart = [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join(DATE_SEPARATOR);
  const timePart = [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join(TIME_SEPARATOR);

  return `${datePart}${DATE_TIME_SEPARATOR}${timePart}`;
}
