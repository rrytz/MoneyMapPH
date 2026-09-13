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
