import type { BillOccurrence, BillPayment } from "@/lib/types";
import { listCutoffPeriodsBetween } from "@/lib/utils/pay-period";
import { startOfMonth, endOfMonth, eachDayOfInterval, addDays } from "date-fns";
import { toISODateString } from "@/lib/utils/date";

export interface CalendarDayCell {
  date: string;
  isInMonth: boolean;
  isToday: boolean;
  isCutoffAnchor: boolean;
  occurrences: Array<BillOccurrence & { paid: boolean; overdue: boolean }>;
}

export function buildCalendarCells(
  year: number,
  month: number, // 0-based
  occurrences: BillOccurrence[],
  payments: BillPayment[],
  todayISO: string
): CalendarDayCell[] {
  const first = startOfMonth(new Date(year, month, 1));
  const last = endOfMonth(new Date(year, month, 1));
  // pad leading week (Monday-start)
  const lead = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - lead);
  let days = eachDayOfInterval({ start: gridStart, end: last });

  // Pad the TRAILING week too. This used to stop at `last`, so the grid was
  // however many days the month happened to span after the leading pad -
  // 31 cells for September 2026, 34 for October. A 7-column grid needs a
  // multiple of 7 or the last row is short and every cell after it is shifted
  // out of its weekday column. September rendered 3 cells in its final row and
  // October 6, leaving ragged gaps under the last week.
  const trail = (7 - (days.length % 7)) % 7;
  if (trail > 0) {
    days = [...days, ...eachDayOfInterval({ start: addDays(last, 1), end: addDays(last, trail) })];
  }

  const paid = new Set(payments.map((p) => `${p.bill_id}|${p.due_date}`));
  const anchors = new Set(
    listCutoffPeriodsBetween(first, last).map((p) => toISODateString(p.periodEnd))
  );

  return days.map((d) => {
    const iso = toISODateString(d);
    return {
      date: iso,
      isInMonth: d >= first && d <= last,
      isToday: iso === todayISO,
      isCutoffAnchor: anchors.has(iso),
      occurrences: occurrences
        .filter((o) => o.dueDate === iso)
        .map((o) => ({
          ...o,
          paid: paid.has(`${o.bill_id}|${o.dueDate}`),
          overdue: !paid.has(`${o.bill_id}|${o.dueDate}`) && iso < todayISO,
        })),
    };
  });
}