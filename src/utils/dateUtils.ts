/**
 * Unified Date and Timezone Utilities for StudyTrophy.
 *
 * ALL day/date math must reflect the user's LOCAL calendar date and local midnight boundaries.
 * In places like Asia/Dhaka (UTC+6), UTC-based date strings shift before 6:00 AM.
 * These utilities guarantee that dates and sprint days stay strictly in the user's local timezone.
 */

const pad = (num: number): string => String(num).padStart(2, '0');

/**
 * Returns the calendar date formatted as 'YYYY-MM-DD' in the user's LOCAL timezone.
 */
export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${year}-${month}-${day}`;
}

/**
 * Parses any date string (YYYY-MM-DD or ISO) into a Date representing
 * 00:00:00.000 (local midnight) on that calendar day.
 */
export function parseLocalDate(dateInput: string | null | undefined): Date {
  if (!dateInput) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  // If input starts with YYYY-MM-DD, extract parts directly
  const datePart = dateInput.split('T')[0];
  const parts = datePart.split('-');
  if (parts.length === 3) {
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month, day, 0, 0, 0, 0);
    }
  }

  // Fallback to Date constructor, then reset to local midnight
  const parsed = new Date(dateInput);
  if (isNaN(parsed.getTime())) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
}

/**
 * Formats a Date to an ISO 8601 string including the user's local timezone offset.
 * Example: '2026-10-04T00:00:00+06:00'
 */
export function toLocalIsoString(date: Date): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absOffsetMin = Math.abs(offsetMin);
  const offsetHours = pad(Math.floor(absOffsetMin / 60));
  const offsetMinutes = pad(absOffsetMin % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMinutes}`;
}

/**
 * Returns the ISO 8601 string representing local midnight (00:00:00) with offset.
 */
export function getLocalMidnightIso(dateInput: string | Date): string {
  const date = typeof dateInput === 'string' ? parseLocalDate(dateInput) : new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate(), 0, 0, 0, 0);
  return toLocalIsoString(date);
}

/**
 * Returns the ISO 8601 string representing local end-of-day (23:59:59) with offset
 * for the end date of a sprint starting on startDate.
 */
export function getLocalSprintEndDateIso(startDateInput: string | Date, durationDays: number): string {
  const start = typeof startDateInput === 'string' ? parseLocalDate(startDateInput) : new Date(startDateInput.getFullYear(), startDateInput.getMonth(), startDateInput.getDate(), 0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (durationDays - 1), 23, 59, 59, 999);
  return toLocalIsoString(end);
}

/**
 * Formats a sprint end date into a human-readable local string: e.g. "Sat, Oct 10, 2026".
 */
export function formatSprintEndDate(startDateInput: string | Date, durationDays: number): string {
  const start = typeof startDateInput === 'string' ? parseLocalDate(startDateInput) : parseLocalDate(getLocalDateString(startDateInput));
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (durationDays - 1));
  return end.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Computes the 1-indexed current sprint day based on local calendar midnight boundaries.
 * Day 1 runs from start_date 00:00:00 local to 23:59:59 local.
 */
export function computeCurrentSprintDay(
  startDateStr: string | null | undefined,
  duration: number,
  nowMs: number = Date.now()
): number {
  if (!startDateStr) return 1;
  const startMidnight = parseLocalDate(startDateStr);
  const now = new Date(nowMs);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  const diffMs = todayMidnight.getTime() - startMidnight.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const dayNum = diffDays + 1;
  const maxDays = duration || 7;
  return Math.min(maxDays, Math.max(1, dayNum));
}

/**
 * Returns the epoch timestamp for 23:59:59.999 local time of a given sprint day.
 */
export function getMidnightEndOfDay(startDateStr: string, dayNumber: number): number {
  const start = parseLocalDate(startDateStr);
  const target = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + (dayNumber - 1),
    23,
    59,
    59,
    999
  );
  return target.getTime();
}
