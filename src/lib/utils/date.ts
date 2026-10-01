import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";

/**
 * The app is exclusively for Philippine users, so every "today" date fed into
 * cutoff/period logic must be the Asia/Manila (UTC+8) wall clock — regardless
 * of the host runtime's timezone (Vercel servers run UTC, and a browser's
 * device clock can also be misconfigured).
 */
const MANILA_TIMEZONE = "Asia/Manila";

export function getManilaNow(utcNow: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MANILA_TIMEZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utcNow);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second")
  );
}

export function formatDate(date: string | Date, fmt: string = "MMM d, yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt);
}

export function getMonthName(month: number): string {
  return format(new Date(2024, month - 1), "MMMM");
}

export function getCurrentMonthYear(utcNow: Date = new Date()): { month: number; year: number } {
  const now = getManilaNow(utcNow);
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function getMonthDateRange(month: number, year: number) {
  const date = new Date(year, month - 1);
  return {
    start: format(startOfMonth(date), "yyyy-MM-dd"),
    end: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

export function toISODateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * Recency for activity feeds ("2h ago"), next to formatDate's absolute dates.
 * Compares instants, so timezones cancel out - no Manila conversion needed.
 * Granularity stops at weeks; older than ~30 days falls back to formatDate,
 * because "11w ago" is trivia and "Sep 3" is information.
 */
export function formatRelativeTime(input: string | Date, now: Date = new Date()): string {
  const then = typeof input === "string" ? new Date(input) : input;
  const diffMs = now.getTime() - then.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return formatDate(then);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "yesterday" : `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return formatDate(then);
}
