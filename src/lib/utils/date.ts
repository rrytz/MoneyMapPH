import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";

export function formatDate(date: string | Date, fmt: string = "MMM d, yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, fmt);
}

export function getMonthName(month: number): string {
  return format(new Date(2024, month - 1), "MMMM");
}

export function getCurrentMonthYear(): { month: number; year: number } {
  const now = new Date();
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
