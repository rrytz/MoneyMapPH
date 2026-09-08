import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getTrailingCutoffIncomes,
  getPeriodCoreIncome,
  getLeanStatus,
} from "@/lib/services/pay-period.service";
import { listCutoffPeriodsBetween } from "@/lib/utils/pay-period";
import { toISODateString } from "@/lib/utils/date";

type Row = Record<string, unknown>;

function makeQueryBuilder(initial: Row[]) {
  let current = initial;
  const q: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((col: string, val: unknown) => {
      current = current.filter((r) => r[col] === val);
      return q;
    }),
    not: vi.fn((col: string, _op: string, val: unknown) => {
      current = current.filter((r) =>
        val === null ? r[col] != null && r[col] !== "" && r[col] !== null : r[col] !== val
      );
      return q;
    }),
    gte: vi.fn((col: string, val: unknown) => {
      current = current.filter((r) => typeof r[col] === "string" && (r[col] as string) >= (val as string));
      return q;
    }),
    lte: vi.fn((col: string, val: unknown) => {
      current = current.filter((r) => typeof r[col] === "string" && (r[col] as string) <= (val as string));
      return q;
    }),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: current[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => void) => Promise.resolve({ data: current, error: null }).then(resolve),
  };
  return q;
}

function makeSupabase(rows: Row[]): SupabaseClient {
  return { from: vi.fn(() => makeQueryBuilder(rows)) } as unknown as SupabaseClient;
}

const USER_ID = "user-123";
// Fixed clock: 2026-09-08. Current cutoff = 2026-09-13 (payout 09-11, in flight).
const NOW = new Date(2026, 8, 8);

function pc(periodEnd: string, amount: number, date: string): Row {
  return { id: `p-${periodEnd}-${amount}`, user_id: USER_ID, period_end: periodEnd, amount, date };
}

describe("getTrailingCutoffIncomes", () => {
  it("groups multiple paychecks per period and sums amounts, sorted desc", async () => {
    const supabase = makeSupabase([
      pc("2026-08-28", 4000, "2026-08-28"),
      pc("2026-08-28", 6000, "2026-08-27"),
      pc("2026-08-13", 9000, "2026-08-13"),
      pc("2026-07-28", 8000, "2026-07-28"),
    ]);
    const incomes = await getTrailingCutoffIncomes(supabase, USER_ID, 24, NOW);
    expect(incomes).toEqual([
      { periodEnd: "2026-08-28", income: 10000 },
      { periodEnd: "2026-08-13", income: 9000 },
      { periodEnd: "2026-07-28", income: 8000 },
    ]);
  });

  it("excludes NULL period_end rows", async () => {
    const supabase = makeSupabase([
      pc("2026-08-28", 5000, "2026-08-28"),
      { id: "legacy", user_id: USER_ID, period_end: null, amount: 7000, date: "2026-08-14" },
    ]);
    const incomes = await getTrailingCutoffIncomes(supabase, USER_ID, 24, NOW);
    expect(incomes).toEqual([{ periodEnd: "2026-08-28", income: 5000 }]);
  });

  it("excludes periods outside the window range", async () => {
    const supabase = makeSupabase([pc("2026-08-28", 5000, "2026-08-28")]);
    const incomes = await getTrailingCutoffIncomes(supabase, USER_ID, 1, NOW);
    // Window = the single most recent cutoff period ending now; 2026-08-28 is outside.
    expect(incomes).toEqual([]);
  });
});

describe("getPeriodCoreIncome", () => {
  it("returns the summed income for a specific period or 0", async () => {
    const supabase = makeSupabase([pc("2026-08-28", 10000, "2026-08-28")]);
    expect(await getPeriodCoreIncome(supabase, USER_ID, "2026-08-28")).toBe(10000);
    expect(await getPeriodCoreIncome(supabase, USER_ID, "2026-08-13")).toBe(0);
  });
});

describe("getLeanStatus", () => {
  // count consecutive COMPLETED cutoffs ending at the newest one before NOW (2026-08-28,
  // payout Fri Aug 28 <= NOW). Median stable at 10000; every period gets 10000 except the newest.
  function manyPeriods(targetAmount: number, count = 24): Row[] {
    const cutoffs = listCutoffPeriodsBetween(new Date(2024, 0, 1), NOW)
      .filter((c) => c.payoutDate.getTime() <= NOW.getTime())
      .slice(-count);
    return cutoffs.map((c, idx) => {
      const isTarget = idx === cutoffs.length - 1;
      return pc(
        toISODateString(c.periodEnd),
        isTarget ? targetAmount : 10000,
        toISODateString(c.payoutDate)
      );
    });
  }

  it("is insufficient with fewer than 6 logged periods (no false lean)", async () => {
    const supabase = makeSupabase([
      pc("2026-08-28", 4000, "2026-08-28"),
      pc("2026-07-28", 5000, "2026-07-28"),
      pc("2026-06-28", 6000, "2026-06-28"),
      pc("2026-05-28", 7000, "2026-05-28"),
      pc("2026-04-28", 8000, "2026-04-28"),
    ]);
    const status = await getLeanStatus(supabase, USER_ID, NOW);
    expect(status.phase).toBe("insufficient");
    expect(status.periodsUsed).toBe(5);
  });

  it("flags lean when the last completed period is below 75% of the median", async () => {
    const supabase = makeSupabase(manyPeriods(6000));
    const status = await getLeanStatus(supabase, USER_ID, NOW);
    expect(status.phase).toBe("lean");
    expect(status.targetPeriodEnd).toBe("2026-08-28");
    expect(status.targetIncome).toBe(6000);
    expect(status.median).toBe(10000);
    expect(status.ratio).toBe(0.6);
  });

  it("reports normal when at or above the 75% threshold (boundary is normal)", async () => {
    const supabase = makeSupabase(manyPeriods(7500));
    const status = await getLeanStatus(supabase, USER_ID, NOW);
    expect(status.phase).toBe("normal");
    expect(status.ratio).toBe(0.75);
  });

  it("reports normal above the threshold", async () => {
    const supabase = makeSupabase(manyPeriods(9000));
    const status = await getLeanStatus(supabase, USER_ID, NOW);
    expect(status.phase).toBe("normal");
    expect(status.ratio).toBe(0.9);
  });

  it("never targets an in-flight (unpaid) current period", async () => {
    const rows = manyPeriods(6000);
    rows.push(pc("2026-09-13", 10000, "2026-09-11"));
    const supabase = makeSupabase(rows);
    const status = await getLeanStatus(supabase, USER_ID, NOW);
    expect(status.targetPeriodEnd).toBe("2026-08-28");
  });

  it("exposes period counts for transparent UI copy", async () => {
    const supabase = makeSupabase(manyPeriods(6000, 10));
    const status = await getLeanStatus(supabase, USER_ID, NOW);
    expect(status.periodsUsed).toBe(10);
    expect(status.windowPeriods).toBe(24);
    expect(status.threshold).toBe(0.75);
  });
});
