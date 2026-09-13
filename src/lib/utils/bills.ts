import { Bill, BillOccurrence } from "@/lib/types";
import {
  getCutoffPeriodForDate,
  getPayoutDateForPeriodEnd,
} from "@/lib/utils/pay-period";
import { toISODateString } from "@/lib/utils/date";
import { lastDayOfMonth } from "date-fns";

export function isBillOnMoneySurfaces(
  bill: Pick<Bill, "expected_amount" | "day_of_month" | "active">
): boolean {
  return bill.expected_amount != null && bill.day_of_month != null && bill.active;
}

export function getBillDueDate(dayOfMonth: number, year: number, month: number): Date {
  const last = lastDayOfMonth(new Date(year, month, 1));
  const candidate = new Date(year, month, dayOfMonth);
  return dayOfMonth > last.getDate() ? last : candidate;
}

function toOccurrence(bill: Bill, dueDate: Date): BillOccurrence {
  const iso = toISODateString(dueDate);
  return {
    bill_id: bill.id,
    billName: bill.name,
    dueDate: iso,
    expectedAmount: Number(bill.expected_amount ?? 0),
    cutoffPeriodEnd: bucketCutoff(dueDate),
  };
}

export function listBillOccurrences(bills: Bill[], from: Date, to: Date): BillOccurrence[] {
  const eligible = bills.filter(isBillOnMoneySurfaces);
  const result: BillOccurrence[] = [];
  const minYear = from.getFullYear();
  const minMonth = from.getMonth();
  const maxYear = to.getFullYear();
  const maxMonth = to.getMonth();

  for (const bill of eligible) {
    const day = bill.day_of_month as number;
    let y = minYear;
    let m = minMonth;
    while (y < maxYear || (y === maxYear && m <= maxMonth)) {
      const due = getBillDueDate(day, y, m);
      if (due >= from && due <= to) result.push(toOccurrence(bill, due));
      m += 1;
      if (m === 12) {
        m = 0;
        y += 1;
      }
    }
  }
  return result;
}

export function getNextPayoutDate(from: Date): Date {
  return getPayoutDateForPeriodEnd(getCutoffPeriodForDate(from).periodEnd);
}

export function bucketCutoff(dueDate: Date): string {
  return toISODateString(getCutoffPeriodForDate(dueDate).periodEnd);
}

export function dueSoonKey(
  occurrences: Array<{ bill_id: string; dueDate: string; expectedAmount: number }>
): string {
  const canonical = occurrences
    .map((o) => `${o.bill_id}|${o.dueDate}|${o.expectedAmount}`)
    .sort()
    .join(";");
  let hash = 5381;
  for (let i = 0; i < canonical.length; i++) {
    hash = ((hash << 5) + hash) ^ canonical.charCodeAt(i);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `bills-due-soon-${hex}`;
}