import { describe, it, expect, vi } from "vitest";
import { makeSupabase } from "@/tests/supabase-mock";
import {
  sumExpenses,
  groupExpensesByCategory,
  computeBudgetedSpent,
  computeUnbudgetedSpent,
  computeRemainingBudget,
  buildUnbudgetedCategoryViews,
  getMonthlyExpenseAggregation,
} from "@/lib/services/expense-aggregation.service";
import type { ExpenseCategory } from "@/lib/types";

const USER_ID = "user-123";
const MONTH = 9;
const YEAR = 2026;

const CATS: ExpenseCategory[] = [
  { id: "c-transport", user_id: USER_ID, name: "Transportation", icon: "🚌", color: null, is_default: false, sort_order: 1, created_at: "", updated_at: "" },
  { id: "c-groceries", user_id: USER_ID, name: "Groceries", icon: "🛒", color: null, is_default: false, sort_order: 2, created_at: "", updated_at: "" },
  { id: "c-supplements", user_id: USER_ID, name: "Supplements", icon: "🧪", color: null, is_default: false, sort_order: 3, created_at: "", updated_at: "" },
  { id: "c-utilities", user_id: USER_ID, name: "Utilities", icon: "💡", color: null, is_default: false, sort_order: 4, created_at: "", updated_at: "" },
  { id: "c-savings", user_id: USER_ID, name: "Savings", icon: "🏦", color: null, is_default: false, sort_order: 5, created_at: "", updated_at: "" },
  { id: "c-misc", user_id: USER_ID, name: "Miscellaneous", icon: "📦", color: null, is_default: false, sort_order: 6, created_at: "", updated_at: "" },
  { id: "c-eating", user_id: USER_ID, name: "Eating Out", icon: "🍽️", color: null, is_default: false, sort_order: 7, created_at: "", updated_at: "" },
];

describe("pure aggregation helpers", () => {
  it("sums amounts safely (strings and numbers)", () => {
    expect(sumExpenses([{ amount: 500 }, { amount: "289" }, { amount: 0 }])).toBe(789);
    expect(sumExpenses([])).toBe(0);
  });

  it("groups expenses by category and never loses a row", () => {
    const byCategory = groupExpensesByCategory([
      { amount: 500, category_id: "c-transport" },
      { amount: 289, category_id: "c-groceries" },
      { amount: 3500, category_id: "c-misc" },
    ]);
    expect(byCategory["c-transport"]).toBe(500);
    expect(byCategory["c-groceries"]).toBe(289);
    expect(byCategory["c-misc"]).toBe(3500);
  });

  it("regression: computes budgeted/unbudgeted split that partitions total actual (₱7,371 = ₱3,389 + ₱3,982)", () => {
    // Verified scenario from Sep 2026 report.
    const byCategory = {
      "c-transport": 500,
      "c-groceries": 289,
      "c-supplements": 0,
      "c-utilities": 300,
      "c-savings": 2300, // incl. two goal-linked contributions (1000 + 1300)
      "c-misc": 3500,
      "c-eating": 482,
    };
    const totalActual = sumExpenses(
      Object.entries(byCategory).map(([category_id, amount]) => ({ category_id, amount }))
    );
    const budgetedCategoryIds = ["c-transport", "c-groceries", "c-supplements", "c-utilities", "c-savings"];
    const budgetedSpent = computeBudgetedSpent(byCategory, budgetedCategoryIds);
    const unbudgetedSpent = computeUnbudgetedSpent(totalActual, budgetedSpent);

    expect(totalActual).toBe(7371);
    expect(budgetedSpent).toBe(3389);
    expect(unbudgetedSpent).toBe(3982);
    expect(totalActual).toBe(budgetedSpent + unbudgetedSpent); // identity can never silently break
  });

  it("computes remaining budget as totalBudget minus spent", () => {
    expect(computeRemainingBudget(14500, 3389)).toBe(11111);
  });

  it("exposes only unbudgeted categories as unbudgeted views, sorted by spent desc", () => {
    const views = buildUnbudgetedCategoryViews(
      { "c-misc": 3500, "c-eating": 482, "c-transport": 500 },
      ["c-transport"], // has a budget -> excluded from unbudgeted views
      CATS
    );
    expect(views.map((v) => v.categoryId)).toEqual(["c-misc", "c-eating"]);
    expect(views[0]).toEqual({ categoryId: "c-misc", name: "Miscellaneous", icon: "📦", color: null, spent: 3500 });
  });
});

describe("getMonthlyExpenseAggregation", () => {
  it("aggregates ALL expenses for the month including goal-linked contributions", async () => {
    const supabase = makeSupabase({
      income_entries: [],
      expenses: [
        { amount: 500, category_id: "c-transport" },
        { amount: 289, category_id: "c-groceries" },
        { amount: 300, category_id: "c-utilities" },
        { amount: 3500, category_id: "c-misc" },
        { amount: 482, category_id: "c-eating" },
        { amount: 1000, category_id: "c-savings", goal_id: "goal-1" },
        { amount: 1300, category_id: "c-savings", goal_id: "goal-1" },
      ],
      budgets: [],
    });

    const agg = await getMonthlyExpenseAggregation(supabase, USER_ID, MONTH, YEAR);

    expect(agg.month).toBe(9);
    expect(agg.year).toBe(2026);
    expect(agg.totalExpenses).toBe(7371);
    expect(agg.expenseCount).toBe(7);
    expect(agg.byCategory["c-savings"]).toBe(2300); // goal-linked rows count toward the ledger total
    expect(agg.byCategory["c-misc"]).toBe(3500);
  });

  it("applies the exact inclusive month boundary 2026-09-01..2026-09-30", async () => {
    const supabase = makeSupabase({ income_entries: [], expenses: [{ amount: 1, category_id: "c1" }], budgets: [] });

    await getMonthlyExpenseAggregation(supabase, USER_ID, MONTH, YEAR);

    const q = vi.mocked(supabase.from).mock.results[0].value as any;
    expect(q.gte).toHaveBeenCalledWith("date", "2026-09-01");
    expect(q.lte).toHaveBeenCalledWith("date", "2026-09-30");
  });

  it("does not leak transactions across month edges (Aug 31 vs Oct 1 ranges)", async () => {
    for (const [m, y, start, end] of [
      [8, 2026, "2026-08-01", "2026-08-31"],
      [9, 2026, "2026-09-01", "2026-09-30"],
      [10, 2026, "2026-10-01", "2026-10-31"],
    ] as Array<[number, number, string, string]>) {
      const supabase = makeSupabase({ income_entries: [], expenses: [{ amount: 1, category_id: "c1" }], budgets: [] });
      await getMonthlyExpenseAggregation(supabase, USER_ID, m, y);
      const q = vi.mocked(supabase.from).mock.results[0].value as any;
      expect(q.gte).toHaveBeenCalledWith("date", start);
      expect(q.lte).toHaveBeenCalledWith("date", end);
    }
  });
});