import { Bill, BillOccurrence } from "@/lib/types";
import {
  getCutoffPeriodForDate,
  getPayoutDateForPeriodEnd,
} from "@/lib/utils/pay-period";
import { getManilaNow, toISODateString } from "@/lib/utils/date";
import { lastDayOfMonth } from "date-fns";

export function isBillOnMoneySurfaces(
  bill: Pick<Bill, "expected_amount" | "day_of_month" | "due_date" | "active">
): boolean {
  // A bill is on the money surfaces if it has an amount, is active, and has SOME
  // schedule. Before one-time bills the only schedule was day_of_month, and a
  // one-time bill would have been rejected here for lacking it - creatable and
  // invisible at the same time.
  if (bill.expected_amount == null || !bill.active) return false;
  return bill.due_date != null || bill.day_of_month != null;
}

/** A bill with a specific date, as opposed to one that recurs on a day. */
export function isOneTimeBill(
  bill: Pick<Bill, "due_date" | "day_of_month">
): boolean {
  return bill.due_date != null;
}

/**
 * The due date for a RECURRING bill in a given month.
 *
 * Only ever called with a number. `getBillDueDate(null, ...)` does not fail
 * loudly - `null > last` is false, and `new Date(y, m, null)` is the LAST DAY
 * OF THE PREVIOUS MONTH, so a null would silently produce a date in the wrong
 * month. The clamp below guards a day that is too LARGE for a short month; it
 * does not guard a missing one. The one-time path in listBillOccurrences
 * therefore branches BEFORE any call here, and never casts a null to a number.
 */
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
    // ONE-TIME FIRST, and this branch deliberately comes before any
    // day_of_month is read or cast. A one-time bill has no day_of_month by
    // design, and passing null into getBillDueDate would not throw - it would
    // return the last day of the PREVIOUS month and quietly put the bill in
    // the wrong place. So the recurrence loop is only ever reached by a bill
    // that actually has a day.
    if (isOneTimeBill(bill)) {
      const oneTime = new Date(`${bill.due_date}T00:00:00`);
      if (oneTime >= from && oneTime <= to) result.push(toOccurrence(bill, oneTime));
      continue;
    }

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

export function getBillsDueWindow(now: Date = getManilaNow()): { fromISO: string; toISO: string } {
  const cutoff = getCutoffPeriodForDate(now);
  const nextPayoutISO = toISODateString(getPayoutDateForPeriodEnd(cutoff.periodEnd));
  const todayPlus7ISO = toISODateString(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
  return {
    fromISO: toISODateString(cutoff.periodStart),
    toISO: todayPlus7ISO > nextPayoutISO ? todayPlus7ISO : nextPayoutISO,
  };
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