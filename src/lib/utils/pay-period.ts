export const CUTOFF_ANCHOR_DAYS = [13, 28] as const;

export interface CutoffPeriod {
  periodEnd: Date;
  periodStart: Date;
  payoutDate: Date;
}

export function getPayoutDateForPeriodEnd(periodEnd: Date): Date {
  const y = periodEnd.getFullYear();
  const m = periodEnd.getMonth();
  const d = periodEnd.getDate();
  const weekday = periodEnd.getDay(); // 0 = Sunday, 6 = Saturday
  if (weekday === 6) return new Date(y, m, d - 1);
  if (weekday === 0) return new Date(y, m, d - 2);
  return new Date(y, m, d);
}

export function getCutoffPeriodForDate(date: Date): CutoffPeriod {
  const y = date.getFullYear();
  const m = date.getMonth();
  const day = date.getDate();

  let periodEnd: Date;
  let periodStart: Date;
  if (day <= 13) {
    periodEnd = new Date(y, m, 13);
    periodStart = new Date(y, m - 1, 29);
  } else if (day <= 28) {
    periodEnd = new Date(y, m, 28);
    periodStart = new Date(y, m, 14);
  } else {
    periodEnd = new Date(y, m + 1, 13);
    periodStart = new Date(y, m, 29);
  }

  return { periodEnd, periodStart, payoutDate: getPayoutDateForPeriodEnd(periodEnd) };
}

export function getPeriodRange(periodEnd: Date): { periodStart: Date; periodEnd: Date } {
  const y = periodEnd.getFullYear();
  const m = periodEnd.getMonth();
  const periodStart = periodEnd.getDate() === 13
    ? new Date(y, m - 1, 29)
    : new Date(y, m, 14);
  return { periodStart, periodEnd: new Date(y, m, periodEnd.getDate()) };
}

export function listCutoffPeriodsBetween(start: Date, end: Date): CutoffPeriod[] {
  const result: CutoffPeriod[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const finalMonth = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cursor <= finalMonth) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    for (const anchor of CUTOFF_ANCHOR_DAYS) {
      const periodEnd = new Date(y, m, anchor);
      const range = getPeriodRange(periodEnd);
      if (range.periodEnd >= start && range.periodStart <= end) {
        result.push({ periodEnd, periodStart: range.periodStart, payoutDate: getPayoutDateForPeriodEnd(periodEnd) });
      }
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return result.sort((a, b) => a.periodEnd.getTime() - b.periodEnd.getTime());
}

export function estimatePeriodEndForPayout(payoutDate: Date): Date {
  const windowStart = new Date(payoutDate.getFullYear(), payoutDate.getMonth() - 1, 1);
  const windowEnd = new Date(payoutDate.getFullYear(), payoutDate.getMonth() + 1, 31);
  const candidates = listCutoffPeriodsBetween(windowStart, windowEnd);

  for (const c of candidates) {
    if (
      c.payoutDate.getFullYear() === payoutDate.getFullYear() &&
      c.payoutDate.getMonth() === payoutDate.getMonth() &&
      c.payoutDate.getDate() === payoutDate.getDate()
    ) {
      return c.periodEnd;
    }
  }
  return getCutoffPeriodForDate(payoutDate).periodEnd;
}

const DAY_MS = 86_400_000;

export interface PeriodProgress {
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  fractionElapsed: number;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getPeriodProgress(periodEnd: Date, now: Date = new Date()): PeriodProgress {
  const { periodStart } = getPeriodRange(periodEnd);
  const daysTotal =
    Math.round((startOfDay(periodEnd).getTime() - startOfDay(periodStart).getTime()) / DAY_MS) + 1;
  const elapsed = Math.round((startOfDay(now).getTime() - startOfDay(periodStart).getTime()) / DAY_MS) + 1;
  const daysElapsed = Math.min(Math.max(elapsed, 0), daysTotal);
  const daysRemaining = Math.max(daysTotal - daysElapsed, 0);
  const fractionElapsed = daysTotal > 0 ? daysElapsed / daysTotal : 0;
  return { daysTotal, daysElapsed, daysRemaining, fractionElapsed };
}