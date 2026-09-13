/**
 * Unit tests for financial.service.ts
 *
 * Strategy: the service functions are async and depend on Supabase.
 * We test the pure arithmetic logic by mocking the SupabaseClient
 * to return controlled data, then asserting on the returned MonthlySummary fields.
 */

import { describe, it, expect } from "vitest";
import { makeSupabase } from "@/tests/supabase-mock";

import { getMonthlySummary } from "@/lib/services/financial.service";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("getMonthlySummary", () => {
  const USER_ID = "user-123";
  const MONTH = 9;
  const YEAR = 2026;

  it("calculates total income from multiple income entries", async () => {
    const supabase = makeSupabase({
      income_entries: [{ amount: 20000, source_id: "s1" }, { amount: 5000, source_id: "s2" }],
      expenses: [],
      budgets: [],
    });

    const summary = await getMonthlySummary(supabase, USER_ID, MONTH, YEAR);

    expect(summary.totalIncome).toBe(25000);
  });

  it("calculates total expenses from multiple expense entries", async () => {
    const supabase = makeSupabase({
      income_entries: [{ amount: 30000, source_id: "s1" }],
      expenses: [
        { amount: 5000, category_id: "c1" },
        { amount: 3000, category_id: "c2" },
      ],
      budgets: [],
    });

    const summary = await getMonthlySummary(supabase, USER_ID, MONTH, YEAR);

    expect(summary.totalExpenses).toBe(8000);
  });

  it("calculates net savings as income minus expenses", async () => {
    const supabase = makeSupabase({
      income_entries: [{ amount: 20000, source_id: "s1" }],
      expenses: [{ amount: 8000, category_id: "c1" }],
      budgets: [],
    });

    const summary = await getMonthlySummary(supabase, USER_ID, MONTH, YEAR);

    expect(summary.savingsAmount).toBe(12000);
  });

  it("calculates savings rate as (savingsAmount / totalIncome) * 100", async () => {
    const supabase = makeSupabase({
      income_entries: [{ amount: 20000, source_id: "s1" }],
      expenses: [{ amount: 15000, category_id: "c1" }],
      budgets: [],
    });

    const summary = await getMonthlySummary(supabase, USER_ID, MONTH, YEAR);

    // (20000 - 15000) / 20000 * 100 = 25%
    expect(summary.savingsRate).toBe(25);
  });

  it("returns savingsRate = 0 when income is zero (no division by zero)", async () => {
    const supabase = makeSupabase({
      income_entries: [],
      expenses: [{ amount: 5000, category_id: "c1" }],
      budgets: [],
    });

    const summary = await getMonthlySummary(supabase, USER_ID, MONTH, YEAR);

    expect(summary.savingsRate).toBe(0);
    expect(Number.isFinite(summary.savingsRate)).toBe(true);
    expect(Number.isNaN(summary.savingsRate)).toBe(false);
  });

  it("calculates budget utilization as (totalExpenses / totalBudget) * 100", async () => {
    const supabase = makeSupabase({
      income_entries: [{ amount: 30000, source_id: "s1" }],
      expenses: [{ amount: 7500, category_id: "c1" }],
      budgets: [{ id: "b1", budget_categories: [{ amount: 10000 }] }],
    });

    const summary = await getMonthlySummary(supabase, USER_ID, MONTH, YEAR);

    // 7500 / 10000 * 100 = 75
    expect(summary.budgetUtilization).toBe(75);
  });

  it("returns budgetUtilization = 0 when no budget is configured", async () => {
    const supabase = makeSupabase({
      income_entries: [{ amount: 30000, source_id: "s1" }],
      expenses: [{ amount: 7500, category_id: "c1" }],
      budgets: [],
    });

    const summary = await getMonthlySummary(supabase, USER_ID, MONTH, YEAR);

    expect(summary.budgetUtilization).toBe(0);
    expect(Number.isFinite(summary.budgetUtilization)).toBe(true);
  });

  it("handles zero income and zero expenses (empty account) without NaN", async () => {
    const supabase = makeSupabase({
      income_entries: [],
      expenses: [],
      budgets: [],
    });

    const summary = await getMonthlySummary(supabase, USER_ID, MONTH, YEAR);

    expect(summary.totalIncome).toBe(0);
    expect(summary.totalExpenses).toBe(0);
    expect(summary.savingsAmount).toBe(0);
    expect(summary.savingsRate).toBe(0);
    expect(summary.budgetUtilization).toBe(0);
    expect(summary.remainingBudget).toBe(0);
    for (const v of Object.values(summary)) {
      if (typeof v === "number") {
        expect(Number.isFinite(v), `Expected finite number, got ${v}`).toBe(true);
      }
    }
  });

  it("builds categorySpending map keyed by category_id", async () => {
    const supabase = makeSupabase({
      income_entries: [{ amount: 20000, source_id: "s1" }],
      expenses: [
        { amount: 2000, category_id: "cat-food" },
        { amount: 3000, category_id: "cat-food" },
        { amount: 5000, category_id: "cat-transport" },
      ],
      budgets: [],
    });

    const summary = await getMonthlySummary(supabase, USER_ID, MONTH, YEAR);

    expect(summary.categorySpending["cat-food"]).toBe(5000);
    expect(summary.categorySpending["cat-transport"]).toBe(5000);
  });

  it("returns negative savingsAmount when expenses exceed income", async () => {
    const supabase = makeSupabase({
      income_entries: [{ amount: 5000, source_id: "s1" }],
      expenses: [{ amount: 8000, category_id: "c1" }],
      budgets: [],
    });

    const summary = await getMonthlySummary(supabase, USER_ID, MONTH, YEAR);

    expect(summary.savingsAmount).toBe(-3000);
    // Savings rate should be negative (over-spending) but finite
    expect(Number.isFinite(summary.savingsRate)).toBe(true);
  });

  it("excludes savings goal contributions from expense totals and category spending", async () => {
    const supabase = makeSupabase({
      income_entries: [{ amount: 30000, source_id: "s1" }],
      expenses: [
        { amount: 5000, category_id: "c1" },
        { amount: 10000, category_id: "c-savings", goal_id: "goal-1" },
      ],
      budgets: [],
    });

    const summary = await getMonthlySummary(supabase, USER_ID, MONTH, YEAR);

    expect(summary.totalExpenses).toBe(5000);
    expect(summary.savingsAmount).toBe(25000);
    expect(summary.categorySpending["c-savings"]).toBeUndefined();
  });
});

import { getBudgetStatuses } from "@/lib/services/financial.service";

describe("getBudgetStatuses", () => {
  const USER_ID = "user-123";
  const MONTH = 9;
  const YEAR = 2026;

  const budgetWith = (spent: number, budgeted: number) =>
    makeSupabase({
      income_entries: [],
      expenses: [{ amount: spent, category_id: "c1" }],
      budgets: [
        {
          id: "b1",
          budget_categories: [
            {
              category_id: "c1",
              amount: budgeted,
              category: { id: "c1", name: "Food", icon: null, color: null },
            },
          ],
        },
      ],
    });

  it("flags a category as 'near' when spending equals the budget exactly (100%)", async () => {
    const supabase = budgetWith(10000, 10000);
    const statuses = await getBudgetStatuses(supabase, USER_ID, MONTH, YEAR);
    expect(statuses[0].status).toBe("near");
  });

  it("flags a category as 'over' only when spending exceeds the budget", async () => {
    const supabase = budgetWith(10001, 10000);
    const statuses = await getBudgetStatuses(supabase, USER_ID, MONTH, YEAR);
    expect(statuses[0].status).toBe("over");
    expect(statuses[0].spent).toBe(10001);
  });

  it("counts savings-goal-contribution expenses in the budget category spent total", async () => {
    // Savings contributions are stored in `expenses` with a goal_id set and the
    // Savings category_id. They must feed the category spent rollup the same way
    // manual entries do.
    const supabase = makeSupabase({
      income_entries: [],
      expenses: [
        { amount: 1000, category_id: "c-savings", goal_id: "goal-1" },
        { amount: 1300, category_id: "c-savings", goal_id: "goal-1" },
      ],
      budgets: [
        {
          id: "b1",
          budget_categories: [
            {
              category_id: "c-savings",
              amount: 5000,
              category: { id: "c-savings", name: "Savings", icon: null, color: null },
            },
          ],
        },
      ],
    });

    const statuses = await getBudgetStatuses(supabase, USER_ID, MONTH, YEAR);

    expect(statuses[0].spent).toBe(2300);
    expect(statuses[0].remaining).toBe(2700);
  });
});
