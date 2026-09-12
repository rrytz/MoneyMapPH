import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSafeToSpend } from "@/lib/services/safe-to-spend.service";

type Row = Record<string, unknown>;

function makeQueryBuilder(initial: Row[]) {
  let current = initial;
  const q: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((col: string, val: unknown) => {
      current = current.filter((r) => r[col] === val);
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
    limit: vi.fn().mockReturnThis(),
    then: (resolve: (v: unknown) => void) => Promise.resolve({ data: current, error: null }).then(resolve),
  };
  return q;
}

function makeSupabase(tables: Record<string, Row[]>): SupabaseClient {
  return { from: vi.fn((t: string) => makeQueryBuilder(tables[t] || [])) } as unknown as SupabaseClient;
}

const USER_ID = "user-123";
// Fixed clock: 2026-09-08. Current cutoff = period A: 2026-08-29..2026-09-13.
const NOW = new Date(2026, 8, 8);

function tables(overrides: Partial<Record<"paychecks" | "income_sources" | "income_entries" | "expenses", Row[]>> = {}) {
  return {
    paychecks: [],
    income_sources: [],
    income_entries: [],
    expenses: [],
    ...overrides,
  };
}

describe("getSafeToSpend", () => {
  it("returns zeroes and hasPaychecks=false for a user with no data", async () => {
    const supabase = makeSupabase(tables());
    const s = await getSafeToSpend(supabase, USER_ID, NOW);
    expect(s).toMatchObject({
      periodStart: "2026-08-29",
      periodEnd: "2026-09-13",
      coreIncome: 0,
      incentiveIncomeLogged: 0,
      spentThisPeriod: 0,
      safeToSpend: 0,
      hasPaychecks: false,
    });
  });

  it("computes core income minus expenses for a paycheck logged in the period", async () => {
    const supabase = makeSupabase(
      tables({
        paychecks: [{ id: "p1", user_id: USER_ID, period_end: "2026-09-13", date: "2026-09-11", amount: 15000 }],
        expenses: [
          { id: "e1", user_id: USER_ID, date: "2026-09-05", amount: 5000 },
          { id: "e2", user_id: USER_ID, date: "2026-09-14", amount: 999 }, // outside period
        ],
      })
    );
    const s = await getSafeToSpend(supabase, USER_ID, NOW);
    expect(s.coreIncome).toBe(15000);
    expect(s.spentThisPeriod).toBe(5000);
    expect(s.safeToSpend).toBe(10000);
    expect(s.hasPaychecks).toBe(true);
  });

  it("counts incentive entries only when logged, and never core-source entries", async () => {
    const supabase = makeSupabase(
      tables({
        paychecks: [{ id: "p1", user_id: USER_ID, period_end: "2026-09-13", date: "2026-09-11", amount: 15000 }],
        income_sources: [
          { id: "s-core", user_id: USER_ID, type: "core" },
          { id: "s-inc", user_id: USER_ID, type: "incentive" },
        ],
        income_entries: [
          { id: "i1", user_id: USER_ID, source_id: "s-inc", date: "2026-09-06", amount: 2000 },
          { id: "i2", user_id: USER_ID, source_id: "s-core", date: "2026-09-06", amount: 9999 },
        ],
        expenses: [{ id: "e1", user_id: USER_ID, date: "2026-09-06", amount: 3000 }],
      })
    );
    const s = await getSafeToSpend(supabase, USER_ID, NOW);
    expect(s.incentiveIncomeLogged).toBe(2000);
    // 15000 + 2000 - 3000; the 9999 core-source entry is NOT counted
    expect(s.safeToSpend).toBe(14000);
  });

  it("reports negative safe-to-spend when overspent", async () => {
    const supabase = makeSupabase(
      tables({
        paychecks: [{ id: "p1", user_id: USER_ID, period_end: "2026-09-13", date: "2026-09-11", amount: 8000 }],
        expenses: [{ id: "e1", user_id: USER_ID, date: "2026-09-01", amount: 10000 }],
      })
    );
    const s = await getSafeToSpend(supabase, USER_ID, NOW);
    expect(s.safeToSpend).toBe(-2000);
  });

  it("respects period_end override, falls back to date for NULL period_end, and ignores foreign periods", async () => {
    const supabase = makeSupabase(
      tables({
        paychecks: [
          { id: "p1", user_id: USER_ID, period_end: "2026-09-13", date: "2026-08-01", amount: 9000 }, // override: in period
          { id: "p2", user_id: USER_ID, period_end: null, date: "2026-09-02", amount: 7000 }, // null fallback: in period
          { id: "p3", user_id: USER_ID, period_end: "2026-08-28", date: "2026-09-02", amount: 3000 }, // other period: ignored
        ],
      })
    );
    const s = await getSafeToSpend(supabase, USER_ID, NOW);
    expect(s.coreIncome).toBe(16000);
  });

  it("rolls the window to period B on the 14th", async () => {
    const nowB = new Date(2026, 8, 15);
    const supabase = makeSupabase(
      tables({
        paychecks: [
          { id: "p1", user_id: USER_ID, period_end: "2026-09-13", date: "2026-09-11", amount: 15000 }, // prior period
          { id: "p2", user_id: USER_ID, period_end: "2026-09-28", date: "2026-09-15", amount: 12000 },
        ],
      })
    );
    const s = await getSafeToSpend(supabase, USER_ID, nowB);
    expect(s.periodStart).toBe("2026-09-14");
    expect(s.periodEnd).toBe("2026-09-28");
    expect(s.coreIncome).toBe(12000);
    expect(s.daysTotal).toBe(15);
  });
});