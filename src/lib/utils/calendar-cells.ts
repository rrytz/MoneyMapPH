import type { BillOccurrence, BillPayment } from "@/lib/types";
import { listCutoffPeriodsBetween } from "@/lib/utils/pay-period";
import { startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
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
  const days = eachDayOfInterval({ start: gridStart, end: last });

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