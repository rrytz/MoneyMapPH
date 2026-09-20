import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMonthlySummary, getBudgetStatuses } from "@/lib/services/financial.service";
import { getSafeToSpend } from "@/lib/services/safe-to-spend.service";
import { calculateFinancialHealthReport } from "@/lib/services/health.service";
import { calculateEmergencyFundStatus } from "@/lib/services/forecast.service";
import { getPaychecks } from "@/lib/services/paycheck.service";

vi.mock("@/lib/services/forecast.service", () => ({
  calculateEmergencyFundStatus: vi.fn(),
}));
vi.mock("@/lib/services/paycheck.service", () => ({
  getPaychecks: vi.fn(),
}));

const mockCalculateEmergencyFundStatus = calculateEmergencyFundStatus as ReturnType<typeof vi.fn>;
const mockGetPaychecks = getPaychecks as ReturnType<typeof vi.fn>;

type Row = Record<string, unknown>;
type ChainTables = Record<string, Row[]>;

function makeChainSupabase(tables: ChainTables): SupabaseClient {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      const rows = tables[table] || [];
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({ data: rows, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: rows[0], error: null }),
      };
    }),
  } as unknown as SupabaseClient;
}

function makeFilteringQueryBuilder(initial: Row[]) {
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

function makeFilteringSupabase(tables: ChainTables): SupabaseClient {
  return { from: vi.fn((t: string) => makeFilteringQueryBuilder(tables[t] || [])) } as unknown as SupabaseClient;
}

function scenarioTables(accountId: string | null | undefined): ChainTables {
  const acc = accountId === undefined ? {} : { account_id: accountId };
  return {
    income_entries: [
      { amount: 50000, source_id: "src-1", ...acc },
      { amount: 10000, source_id: "src-2", ...acc },
    ],
    expenses: [
      { amount: 15000, category_id: "cat-1", goal_id: null, ...acc },
      { amount: 5000, category_id: "cat-2", goal_id: null, ...acc },
    ],
    budgets: [
      {
        id: "b-1",
        budget_categories: [
          { category_id: "cat-1", amount: 20000, category: { id: "cat-1", name: "Food", icon: null, color: null } },
        ],
      },
    ],
  };
}

describe("Accounts Non-Regression Suite", () => {
  const userId = "user-123";

  it("produces identical monthly summary regardless of account_id presence or nullability", async () => {
    const summary = await getMonthlySummary(makeChainSupabase(scenarioTables("acc-1")), userId, 9, 2026);
    const summaryNull = await getMonthlySummary(makeChainSupabase(scenarioTables(null)), userId, 9, 2026);
    const summaryAbsent = await getMonthlySummary(makeChainSupabase(scenarioTables(undefined)), userId, 9, 2026);

    // Total income = 50000 + 10000 = 60000 (includes tagged and unassigned)
    expect(summary.totalIncome).toBe(60000);
    // Total expenses = 15000 + 5000 = 20000 (includes tagged and unassigned)
    expect(summary.totalExpenses).toBe(20000);
    // Remaining budget = 20000 - 20000 = 0
    expect(summary.remainingBudget).toBe(0);
    // Savings rate = ((60000 - 20000) / 60000) * 100 = 66.67%
    expect(summary.savingsRate).toBe(66.67);

    expect(summary).toEqual(summaryNull);
    expect(summary).toEqual(summaryAbsent);
  });

  it("produces identical budget statuses regardless of account_id presence or nullability", async () => {
    const statuses = await getBudgetStatuses(makeChainSupabase(scenarioTables("acc-1")), userId, 9, 2026);
    const statusesNull = await getBudgetStatuses(makeChainSupabase(scenarioTables(null)), userId, 9, 2026);
    const statusesAbsent = await getBudgetStatuses(makeChainSupabase(scenarioTables(undefined)), userId, 9, 2026);

    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toMatchObject({
      categoryId: "cat-1",
      categoryName: "Food",
      budgeted: 20000,
      spent: 15000,
      remaining: 5000,
      percentage: 75,
      status: "near",
    });

    expect(statuses).toEqual(statusesNull);
    expect(statuses).toEqual(statusesAbsent);
  });

  it("produces identical safe-to-spend output regardless of account_id presence or nullability", async () => {
    // Fixed clock: 2026-09-08. Current cutoff = period A: 2026-08-29..2026-09-13.
    const NOW = new Date(2026, 8, 8);

    function safeToSpendTables(accountId: string | null | undefined): ChainTables {
      const acc = accountId === undefined ? {} : { account_id: accountId };
      return {
        paychecks: [{ id: "p1", user_id: userId, period_end: "2026-09-13", date: "2026-09-11", amount: 15000 }],
        income_sources: [
          { id: "s-core", user_id: userId, type: "core" },
          { id: "s-inc", user_id: userId, type: "incentive" },
        ],
        income_entries: [
          { id: "i1", user_id: userId, source_id: "s-inc", date: "2026-09-06", amount: 2000, ...acc },
          { id: "i2", user_id: userId, source_id: "s-core", date: "2026-09-06", amount: 9999, ...acc },
        ],
        expenses: [{ id: "e1", user_id: userId, date: "2026-09-05", amount: 3000, ...acc }],
      };
    }

    const withAccount = await getSafeToSpend(makeFilteringSupabase(safeToSpendTables("acc-1")), userId, NOW);
    const withNull = await getSafeToSpend(makeFilteringSupabase(safeToSpendTables(null)), userId, NOW);
    const withAbsent = await getSafeToSpend(makeFilteringSupabase(safeToSpendTables(undefined)), userId, NOW);

    // 15000 core + 2000 incentive - 3000 expenses = 14000
    expect(withAccount.safeToSpend).toBe(14000);

    expect(withAccount).toEqual(withNull);
    expect(withAccount).toEqual(withAbsent);
  });

  it("produces identical financial health report regardless of account_id presence or nullability", async () => {
    mockCalculateEmergencyFundStatus.mockResolvedValue({
      hasFund: true,
      currentBalance: 60000,
      targetAmount: 60000,
      averageExpenses: 10000,
      monthsCovered: 6,
      status: "adequate",
    });
    mockGetPaychecks.mockResolvedValue([
      { id: "p1", amount: 30000, name: "Salary", allocations: [{ amount: 30000 }] },
    ]);

    const withAccount = await calculateFinancialHealthReport(makeChainSupabase(scenarioTables("acc-1")), userId);
    const withNull = await calculateFinancialHealthReport(makeChainSupabase(scenarioTables(null)), userId);
    const withAbsent = await calculateFinancialHealthReport(makeChainSupabase(scenarioTables(undefined)), userId);

    // 30 (savings rate) + 30 (emergency fund) + 20 (budget adherence) + 20 (allocation) = 100
    expect(withAccount.score).toBe(100);
    expect(withAccount.grade).toBe("Excellent");

    expect(withAccount).toEqual(withNull);
    expect(withAccount).toEqual(withAbsent);
  });
});