import { describe, it, expect } from "vitest";
import {
  CUTOFF_ANCHOR_DAYS,
  getCutoffPeriodForDate,
  getPayoutDateForPeriodEnd,
  getPeriodProgress,
  getPeriodRange,
  listCutoffPeriodsBetween,
  estimatePeriodEndForPayout,
} from "@/lib/utils/pay-period";

function ymd(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d);
}

describe("CUTOFF_ANCHOR_DAYS", () => {
  it("anchors on the 13th and 28th", () => {
    expect(CUTOFF_ANCHOR_DAYS).toEqual([13, 28]);
  });
});

describe("getPayoutDateForPeriodEnd", () => {
  it("Sunday 13th pays the preceding Friday", () => {
    expect(getPayoutDateForPeriodEnd(ymd(2026, 9, 13))).toEqual(ymd(2026, 9, 11));
  });
  it("Saturday 28th pays the preceding Friday", () => {
    expect(getPayoutDateForPeriodEnd(ymd(2026, 11, 28))).toEqual(ymd(2026, 11, 27));
  });
  it("Saturday 13th pays the preceding Friday", () => {
    expect(getPayoutDateForPeriodEnd(ymd(2027, 2, 13))).toEqual(ymd(2027, 2, 12));
  });
  it("a non-weekend 28th pays on the 28th", () => {
    expect(getPayoutDateForPeriodEnd(ymd(2026, 9, 28))).toEqual(ymd(2026, 9, 28));
  });
  it("a Sunday 13th (Dec) pays the preceding Friday", () => {
    expect(getPayoutDateForPeriodEnd(ymd(2026, 12, 13))).toEqual(ymd(2026, 12, 11));
  });
  it("a non-weekend 13th pays on the 13th", () => {
    expect(getPayoutDateForPeriodEnd(ymd(2026, 10, 13))).toEqual(ymd(2026, 10, 13));
  });
});

describe("getCutoffPeriodForDate", () => {
  it("the 8th belongs to this month's 13th cutoff, starting the 29th of the prior month", () => {
    const p = getCutoffPeriodForDate(ymd(2026, 9, 8));
    expect(p.periodEnd).toEqual(ymd(2026, 9, 13));
    expect(p.periodStart).toEqual(ymd(2026, 8, 29));
  });
  it("the 14th belongs to this month's 28th cutoff, starting the 14th", () => {
    const p = getCutoffPeriodForDate(ymd(2026, 9, 14));
    expect(p.periodEnd).toEqual(ymd(2026, 9, 28));
    expect(p.periodStart).toEqual(ymd(2026, 9, 14));
  });
  it("the 29th belongs to next month's 13th cutoff (cross-month)", () => {
    const p = getCutoffPeriodForDate(ymd(2026, 12, 29));
    expect(p.periodEnd).toEqual(ymd(2027, 1, 13));
    expect(p.periodStart).toEqual(ymd(2026, 12, 29));
  });
  it("the 13th itself belongs to the 13th cutoff", () => {
    const p = getCutoffPeriodForDate(ymd(2026, 9, 13));
    expect(p.periodEnd).toEqual(ymd(2026, 9, 13));
  });
  it("payoutDate is the weekend-shifted date", () => {
    expect(getCutoffPeriodForDate(ymd(2026, 9, 8)).payoutDate).toEqual(ymd(2026, 9, 11));
  });
});

describe("getPeriodRange", () => {
  it("13th cutoff spans prev-29th .. 13th", () => {
    const r = getPeriodRange(ymd(2026, 9, 13));
    expect(r.periodStart).toEqual(ymd(2026, 8, 29));
    expect(r.periodEnd).toEqual(ymd(2026, 9, 13));
  });
  it("28th cutoff spans 14th .. 28th", () => {
    const r = getPeriodRange(ymd(2026, 9, 28));
    expect(r.periodStart).toEqual(ymd(2026, 9, 14));
    expect(r.periodEnd).toEqual(ymd(2026, 9, 28));
  });
});

describe("listCutoffPeriodsBetween", () => {
  it("lists cutoffs ascending across a month boundary", () => {
    const list = listCutoffPeriodsBetween(ymd(2026, 12, 29), ymd(2027, 1, 13));
    expect(list.map((p) => p.periodEnd)).toEqual([ymd(2027, 1, 13)]);
  });
  it("includes overlapping cutoffs in a wider range", () => {
    const list = listCutoffPeriodsBetween(ymd(2026, 8, 1), ymd(2026, 10, 31));
    const ends = list.map((p) => ymd(p.periodEnd.getFullYear(), p.periodEnd.getMonth() + 1, p.periodEnd.getDate()));
    expect(ends).toEqual([
      ymd(2026, 8, 13), ymd(2026, 8, 28),
      ymd(2026, 9, 13), ymd(2026, 9, 28),
      ymd(2026, 10, 13), ymd(2026, 10, 28),
    ]);
  });
});

describe("estimatePeriodEndForPayout", () => {
  it("a Friday payout rolled back from a Sunday 13th maps to that 13th", () => {
    expect(estimatePeriodEndForPayout(ymd(2026, 9, 11))).toEqual(ymd(2026, 9, 13));
  });
  it("a Friday payout rolled back from a Saturday 28th maps to that 28th", () => {
    expect(estimatePeriodEndForPayout(ymd(2026, 11, 27))).toEqual(ymd(2026, 11, 28));
  });
  it("an on-anchor payday maps to itself", () => {
    expect(estimatePeriodEndForPayout(ymd(2026, 9, 28))).toEqual(ymd(2026, 9, 28));
  });
  it("a mid-period pay date falls back to its containing cutoff", () => {
    expect(estimatePeriodEndForPayout(ymd(2026, 9, 18))).toEqual(ymd(2026, 9, 28));
  });
});

describe("getPeriodProgress", () => {
  const PERIOD_END_B = new Date(2026, 8, 28); // period B: 2026-09-14..2026-09-28 (15 days, inclusive)

  it("returns days left at the very start of the period", () => {
    const p = getPeriodProgress(PERIOD_END_B, new Date(2026, 8, 13));
    expect(p.daysTotal).toBe(15);
    expect(p.daysElapsed).toBe(0);
    expect(p.daysRemaining).toBe(15);
    expect(p.fractionElapsed).toBe(0);
  });

  it("counts the first day as elapsed on periodStart", () => {
    const p = getPeriodProgress(PERIOD_END_B, new Date(2026, 8, 14));
    expect(p.daysElapsed).toBe(1);
    expect(p.daysRemaining).toBe(14);
    expect(p.fractionElapsed).toBeCloseTo(1 / 15);
  });

  it("reaches 1 on periodEnd", () => {
    const p = getPeriodProgress(new Date(2026, 8, 13), new Date(2026, 8, 13));
    // period A: 2026-08-29..2026-09-13 (16 days, inclusive)
    expect(p.daysTotal).toBe(16);
    expect(p.daysElapsed).toBe(16);
    expect(p.daysRemaining).toBe(0);
    expect(p.fractionElapsed).toBe(1);
  });

  it("clamps past the period end", () => {
    const p = getPeriodProgress(PERIOD_END_B, new Date(2026, 8, 29));
    expect(p.daysElapsed).toBe(15);
    expect(p.daysRemaining).toBe(0);
    expect(p.fractionElapsed).toBe(1);
  });
});
