# Cross-Page Expense/Budget Consistency (Actual vs Budgeted vs Unbudgeted) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the financial model explicit so MoneyMap PH never silently omits transactions: introduce a single shared expense-aggregation layer whose three views — Total Actual Spending, Budgeted Spending, Unbudgeted Spending — satisfy `actual = budgeted + unbudgeted` by construction, and surface them on the Budget Planner and Expenses page with correct labels.

**Architecture:** A new `src/lib/services/expense-aggregation.service.ts` holds (a) pure aggregation helpers (`sumExpenses`, `groupExpensesByCategory`, `computeBudgetedSpent`, `computeUnbudgetedSpent`, `computeRemainingBudget`, `buildUnbudgetedCategoryViews`) and (b) `getMonthlyExpenseAggregation()`, one query over the month's `expenses` rows (goal-linked INCLUDED, matching the Expenses ledger). `getBudgetStatuses` is refactored to reuse the same grouping helper (behavior unchanged). The Budget Planner renders four header cards plus "No budget configured" cards for unbudgeted categories with a Set Limit button; the Expenses page sources its Monthly Spend / Top Category / count from the aggregation, fixing the `limit: 50` total undercount.

**Tech Stack:** TypeScript 5, Next.js 16.2.12 (Turbopack), Supabase + Postgres, Vitest 5 (mocked supabase query builders via `src/tests/supabase-mock.ts`), Tailwind 4, date-fns 4, lucide-react.

**Spec:** Approved design in conversation (brainstorming session, 2026-09-14). Audit + decisions recorded in chat; no separate spec doc was produced per user preference.

## Global Constraints

- **Do NOT alter the meaning of savings contributions or `getMonthlySummary()`.** `getMonthlySummary` keeps `.is("goal_id", null)` on its expenses query (goal-linked = money set aside, excluded from net-flow math: dashboard Remaining Budget, savings rate, snapshots, forecasts, health scoring). That is intentional, documented at financial.service.ts:25-28, and covered by `src/tests/financial.service.test.ts`.
- `getBudgetStatuses` semantics are preserved verbatim: budgeted-category spent INCLUDES goal-linked contributions (commit `e526c21`), date range via `getMonthDateRange`, statuses via `computeBudgetStatus`.
- The regression identity MUST hold: `totalActual = budgeted + unbudgeted`, using the SAME table (`expenses`) and SAME month range for all three.
- No schema/migration/auth/Server Action/API-contract changes. Existing `revalidatePath` sets in expenses/actions.ts and budgets/actions.ts are preserved unchanged.
- Date rules: month range is `getMonthDateRange(m, y)` — `yyyy-MM-dd` inclusive `[start,end]`; "today" is Manila-pinned via `getManilaNow` (only affects which month is "current", never the range math).
- New aggregation query MUST include goal-linked expense rows (no `.is("goal_id", null)`) so it matches the Expenses ledger exactly.
- Import safety: `expense-aggregation.service.ts` must keep `@supabase/supabase-js` as a TYPE-ONLY import so pure helpers can be imported from `"use client"` components without pulling server-only code (the service must not import `supabase/server` or `supabase/client`).

---

### Task 1: Types + pure aggregation helpers + `getMonthlyExpenseAggregation` (with the ₱7,371 regression test)

**Files:**
- Modify: `src/lib/types/index.ts` (add `MonthlyExpenseAggregation`, `UnbudgetedCategorySpend`)
- Create: `src/lib/services/expense-aggregation.service.ts`
- Test: `src/tests/expense-aggregation.service.test.ts`

**Interfaces:**
- Produces (used by Tasks 2-5):
  - `sumExpenses(rows: Array<{ amount: number | string }>): number`
  - `groupExpensesByCategory(rows: Array<{ amount: number | string; category_id: string }>): Record<string, number>`
  - `computeBudgetedSpent(byCategory: Record<string, number>, budgetedCategoryIds: string[]): number`
  - `computeUnbudgetedSpent(totalExpenses: number, budgetedSpent: number): number`
  - `computeRemainingBudget(totalBudget: number, spent: number): number`
  - `buildUnbudgetedCategoryViews(byCategory: Record<string, number>, budgetedCategoryIds: string[], categories: ExpenseCategory[]): UnbudgetedCategorySpend[]`
  - `getMonthlyExpenseAggregation(supabase: SupabaseClient, userId: string, month: number, year: number): Promise<MonthlyExpenseAggregation>`
  - Types: `MonthlyExpenseAggregation { month; year; totalExpenses; expenseCount; byCategory }`, `UnbudgetedCategorySpend { categoryId; name; icon; color; spent }`

- [ ] **Step 1a: Write the failing types**

Add to `src/lib/types/index.ts` before the final `export type SummaryVerdict` line:

```ts
export interface MonthlyExpenseAggregation {
  month: number;
  year: number;
  totalExpenses: number;
  expenseCount: number;
  byCategory: Record<string, number>;
}

export interface UnbudgetedCategorySpend {
  categoryId: string;
  name: string;
  icon: string | null;
  color: string | null;
  spent: number;
}
```

- [ ] **Step 1b: Write the failing tests**

Create `src/tests/expense-aggregation.service.test.ts`:

```ts
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
```

- [ ] **Step 1c: Run tests to verify they fail**

Run: `npx vitest run src/tests/expense-aggregation.service.test.ts`
Expected: FAIL — `Cannot find module "@/lib/services/expense-aggregation.service"`

- [ ] **Step 1d: Implement types**

Add the two interfaces from Step 1a to `src/lib/types/index.ts` (place near `MonthlySummary`).

- [ ] **Step 1e: Implement the aggregation service**

Create `src/lib/services/expense-aggregation.service.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpenseCategory, MonthlyExpenseAggregation, UnbudgetedCategorySpend } from "@/lib/types";
import { getMonthDateRange } from "@/lib/utils/date";
```

```ts
// goal-linked rows are intentionally INCLUDED: the ledger and the planner's
// "Total Actual Spending" must match the Expenses page exactly. This is the
// "all transactions" view, distinct from getMonthlySummary's net-flow view.

export function sumExpenses(rows: Array<{ amount: number | string }>): number {
  return rows.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

export function groupExpensesByCategory(
  rows: Array<{ amount: number | string; category_id: string }>
): Record<string, number> {
  const byCategory: Record<string, number> = {};
  (rows || []).forEach((e) => {
    byCategory[e.category_id] = (byCategory[e.category_id] || 0) + (Number(e.amount) || 0);
  });
  return byCategory;
}

export function computeBudgetedSpent(
  byCategory: Record<string, number>,
  budgetedCategoryIds: string[]
): number {
  return budgetedCategoryIds.reduce((sum, cid) => sum + (byCategory[cid] || 0), 0);
}

export function computeUnbudgetedSpent(totalExpenses: number, budgetedSpent: number): number {
  return totalExpenses - budgetedSpent;
}

export function computeRemainingBudget(totalBudget: number, spent: number): number {
  return totalBudget - spent;
}

export function buildUnbudgetedCategoryViews(
  byCategory: Record<string, number>,
  budgetedCategoryIds: string[],
  categories: ExpenseCategory[]
): UnbudgetedCategorySpend[] {
  const budgeted = new Set(budgetedCategoryIds);
  return Object.entries(byCategory)
    .filter(([categoryId]) => !budgeted.has(categoryId))
    .map(([categoryId, spent]) => {
      const cat = categories.find((c) => c.id === categoryId);
      return {
        categoryId,
        name: cat?.name || "Uncategorized",
        icon: cat?.icon || null,
        color: cat?.color || null,
        spent,
      };
    })
    .sort((a, b) => b.spent - a.spent);
}

export async function getMonthlyExpenseAggregation(
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<MonthlyExpenseAggregation> {
  const { start, end } = getMonthDateRange(month, year);

  const { data: expenses, error } = await supabase
    .from("expenses")
    .select("amount, category_id")
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end);

  if (error) throw error;

  const rows = (expenses || []) as Array<{ amount: number; category_id: string }>;

  return {
    month,
    year,
    totalExpenses: sumExpenses(rows),
    expenseCount: rows.length,
    byCategory: groupExpensesByCategory(rows),
  };
}
```

- [ ] **Step 1f: Run tests to verify they pass**

Run: `npx vitest run src/tests/expense-aggregation.service.test.ts`
Expected: PASS (all tests)

- [ ] **Step 1g: Commit**

```bash
git add src/lib/types/index.ts src/lib/services/expense-aggregation.service.ts src/tests/expense-aggregation.service.test.ts
git commit -m "feat(aggregation): shared expense aggregation with actual/budgeted/unbudgeted split"
```

---

### Task 2: Refactor `getBudgetStatuses` to reuse the shared grouping (no behavior change)

**Files:**
- Modify: `src/lib/services/financial.service.ts:112-118`
- Test: `src/tests/financial.service.test.ts` (must stay green)

**Interfaces:**
- Consumes: `groupExpensesByCategory` from Task 1.
- Produces: unchanged `BudgetStatus[]` contract; `financial.service.ts` now depends on `expense-aggregation.service.ts` (one-way, no cycle).

- [ ] **Step 2a: Write the failing test**

Skip — the existing `getBudgetStatuses` tests already pin the contract, including the goal-linked scenario at financial.service.test.ts:222-250. The refactor is verified by those staying green.

- [ ] **Step 2b: Implement**

In `src/lib/services/financial.service.ts`:
- Add import: `import { groupExpensesByCategory } from "./expense-aggregation.service";`
- Replace lines 112-118 (the `spendingByCategory` inline loop) with:

```ts
  const spendingByCategory = groupExpensesByCategory(
    (expenses || []) as Array<{ amount: number; category_id: string }>
  );
```

- Keep the query block and the explanatory comment at financial.service.ts:99-104 unchanged.

- [ ] **Step 2c: Run tests to verify the contract is preserved**

Run: `npx vitest run src/tests/financial.service.test.ts src/tests/expense-aggregation.service.test.ts`
Expected: PASS

- [ ] **Step 2d: Commit**

```bash
git add src/lib/services/financial.service.ts
git commit -m "refactor(budgets): derive budget status spent from shared aggregation"
```

---

### Task 3: Wire the aggregation into the Expenses page (deduplicate Monthly Spend)

**Files:**
- Modify: `src/lib/cache/shared-queries.ts` (add `cachedGetMonthlyExpenseAggregation`)
- Modify: `src/app/(dashboard)/expenses/page.tsx`
- Modify: `src/app/(dashboard)/expenses/expenses-page-client.tsx`

**Interfaces:**
- Consumes: `cachedGetMonthlyExpenseAggregation` from shared-queries (wraps Task 1's `getMonthlyExpenseAggregation`), types from Task 1.
- Produces:
  - `cachedGetMonthlyExpenseAggregation(supabase, userId, month, year): Promise<MonthlyExpenseAggregation>`
  - `ExpensesPageClient` new props: `totalThisMonth: number` (now exact), `expenseCount: number`, `categoryTotals: Record<string, number>`.

- [ ] **Step 3a: Write the failing test**

Skip — page wiring relies on already-tested service output. The behavioral guarantee (Monthly Spend == exact total, not a 50-row reduce) is covered by the Task 1 tests and verified manually at the end.

- [ ] **Step 3b: Add the cached wrapper**

In `src/lib/cache/shared-queries.ts` add import and wrapper (after `cachedGetBudgetStatuses`):

```ts
import { getMonthlyExpenseAggregation } from "@/lib/services/expense-aggregation.service";
import type { MonthlyExpenseAggregation } from "@/lib/types";
```

```ts
export const cachedGetMonthlyExpenseAggregation = (
  supabase: SupabaseClient,
  userId: string,
  month: number,
  year: number
): Promise<MonthlyExpenseAggregation> =>
  unstable_cache(
    async (m: number, y: number) => getMonthlyExpenseAggregation(supabase, userId, m, y),
    ["expense-aggregation", userId],
    { revalidate: REVALIDATE_SECONDS, tags: [`q:summary:${userId}`, "q:financial"] }
  )(month, year);
```

- [ ] **Step 3c: Update the server page**

In `src/app/(dashboard)/expenses/page.tsx`:

```tsx
import { cachedGetMonthlyExpenseAggregation as getExpenseAggregation } from "@/lib/cache/shared-queries";
```

Change the `Promise.all` to fetch the aggregation and pass exact values:

```tsx
  const { month, year } = getCurrentMonthYear();
  const [{ data: entries }, categories, aggregation] = await Promise.all([
    getExpenses(supabase, user.id, { month, year, limit: 50 }),
    getExpenseCategories(supabase, user.id),
    getExpenseAggregation(supabase, user.id, month, year),
  ]);

  return (
    <ExpensesPageClient
      initialEntries={entries}
      categories={categories}
      totalThisMonth={aggregation.totalExpenses}
      expenseCount={aggregation.expenseCount}
      categoryTotals={aggregation.byCategory}
      currentMonth={month}
      currentYear={year}
    />
  );
```

Remove the old `const totalThisMonth = entries.reduce(...)` line.

- [ ] **Step 3d: Update the client component**

In `src/app/(dashboard)/expenses/expenses-page-client.tsx`:
- Extend props interface and destructuring:

```tsx
interface ExpensesPageClientProps {
  initialEntries: Expense[];
  categories: ExpenseCategory[];
  totalThisMonth: number;
  expenseCount: number;
  categoryTotals: Record<string, number>;
  currentMonth: number;
  currentYear: number;
}

export function ExpensesPageClient({
  initialEntries,
  categories,
  totalThisMonth: initialTotal,
  expenseCount: initialCount,
  categoryTotals: initialCategoryTotals,
}: ExpensesPageClientProps) {
```

- Add local state (re-syncs from server props after actions, supports optimistic updates):

```tsx
  const [total, setTotal] = useState(initialTotal);
  const [count, setCount] = useState(initialCount);
  const [categoryTotals, setCategoryTotals] = useState(initialCategoryTotals);
  useEffect(() => { setTotal(initialTotal); }, [initialTotal]);
  useEffect(() => { setCount(initialCount); }, [initialCount]);
  useEffect(() => { setCategoryTotals(initialCategoryTotals); }, [initialCategoryTotals]);
```

(import `useEffect` from "react")

- In `handleAddExpense`, bump optimistically (revert on error):

```tsx
  function handleAddExpense(data: { title: string; amount: number; category_id: string; date: string; notes?: string }) {
    const category = categories.find((c) => c.id === data.category_id);
    const optimistic: Expense = { /* unchanged from current code */ };

    setTotal((v) => v + data.amount);
    setCount((v) => v + 1);
    setCategoryTotals((prev) => ({ ...prev, [data.category_id]: (prev[data.category_id] || 0) + data.amount }));

    startTransition(async () => {
      addOptimisticEntry(optimistic);
      try {
        const result = await addExpense(data);
        if (result.error) {
          toast.error(result.error);
          setTotal((v) => v - data.amount);
          setCount((v) => v - 1);
          setCategoryTotals((prev) => ({ ...prev, [data.category_id]: (prev[data.category_id] || 0) - data.amount }));
        } else {
          toast.success("Expense added");
        }
      } catch {
        toast.error("Unable to add expense. Please try again.");
        setTotal((v) => v - data.amount);
        setCount((v) => v - 1);
        setCategoryTotals((prev) => ({ ...prev, [data.category_id]: (prev[data.category_id] || 0) - data.amount }));
      }
    });
    setFormOpen(false);
  }
```

- Keep `handleDelete` as-is (server props re-sync totals after the action; the list item is removed on server render).
- Replace the top-KPI cards to use state instead of props/list-derived values:
  - Monthly Spend card → `amount={total}` (unchanged className), keep badge "Total Outflow" and label "Monthly Spend".
  - Top Category card → derive from `categoryTotals`:

```tsx
  const sortedCategories = Object.entries(categoryTotals)
    .map(([categoryId, amount]) => {
      const cName = categories.find((c) => c.id === categoryId)?.name || "Uncategorized";
      return { name: cName, amount };
    })
    .sort((a, b) => b.amount - a.amount);
  const topCategory = sortedCategories[0] || { name: "None", amount: 0 };
```

  - Total Expenses card → `{count}` (keep label "Total Expenses").

- Remove the old `categoryTotals` derived block that iterated `optimisticEntries` (replaced by the state above).

- [ ] **Step 3e: Run tests + typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (existing suite green, no type errors)

- [ ] **Step 3f: Commit**

```bash
git add src/lib/cache/shared-queries.ts "src/app/(dashboard)/expenses/page.tsx" "src/app/(dashboard)/expenses/expenses-page-client.tsx"
git commit -m "fix(expenses): source monthly totals from shared aggregation (no 50-row cap)"
```

---

### Task 4: Budget Planner — four-card header + unbudgeted category cards

**Files:**
- Modify: `src/app/(dashboard)/budgets/page.tsx`
- Modify: `src/app/(dashboard)/budgets/budgets-page-client.tsx`

**Interfaces:**
- Consumes: `cachedGetMonthlyExpenseAggregation` (Task 3), `buildUnbudgetedCategoryViews` (Task 1), `computeUnbudgetedSpent` (Task 1).
- Produces: `BudgetsPageClient` new prop `aggregation: MonthlyExpenseAggregation`.

- [ ] **Step 4a: Failing test**

Skip — the regression identity is pinned in Task 1's test; the client wiring is verified manually (totals render, unbudgeted cards render only non-budgeted categories) plus `tsc`/`lint`/`build`.

- [ ] **Step 4b: Server page fetches aggregation**

In `src/app/(dashboard)/budgets/page.tsx`:

```tsx
import { cachedGetMonthlyExpenseAggregation as getExpenseAggregation } from "@/lib/cache/shared-queries";
```

```tsx
  const { month, year } = getCurrentMonthYear();
  const [statuses, categories, aggregation] = await Promise.all([
    getBudgetStatuses(supabase, user.id, month, year),
    getExpenseCategories(supabase, user.id),
    getExpenseAggregation(supabase, user.id, month, year),
  ]);

  return (
    <BudgetsPageClient
      statuses={statuses}
      categories={categories}
      aggregation={aggregation}
      currentMonth={month}
      currentYear={year}
    />
  );
```

- [ ] **Step 4c: Client — imports + props**

In `src/app/(dashboard)/budgets/budgets-page-client.tsx`:
- Add imports:

```tsx
import { useEffect } from "react";
import { computeUnbudgetedSpent, buildUnbudgetedCategoryViews } from "@/lib/services/expense-aggregation.service";
import type { BudgetStatus, ExpenseCategory, MonthlyExpenseAggregation } from "@/lib/types";
```

- Extend props:

```tsx
interface BudgetsPageClientProps {
  statuses: BudgetStatus[];
  categories: ExpenseCategory[];
  aggregation: MonthlyExpenseAggregation;
  currentMonth: number;
  currentYear: number;
}
```

- Destructure `aggregation` and derive totals + local total-actual state:

```tsx
export function BudgetsPageClient({
  statuses,
  categories,
  aggregation,
  currentMonth: initialMonth,
  currentYear: initialYear,
}: BudgetsPageClientProps) {
```

```tsx
  const [actualTotal, setActualTotal] = useState(aggregation.totalExpenses);
  useEffect(() => { setActualTotal(aggregation.totalExpenses); }, [aggregation.totalExpenses]);

  const budgetedCategoryIds = statuses.map((s) => s.categoryId);
  const unbudgetedViews = buildUnbudgetedCategoryViews(aggregation.byCategory, budgetedCategoryIds, categories);

  const totalBudgeted = optimisticStatuses.reduce((sum, s) => sum + s.budgeted, 0);
  const totalBudgetedSpent = optimisticStatuses.reduce((sum, s) => sum + s.spent, 0);
  const totalUnbudgetedSpent = computeUnbudgetedSpent(actualTotal, totalBudgetedSpent);
  const totalRemaining = totalBudgeted - totalBudgetedSpent;
```

(Note: `actualTotal` state replaces the old `totalSpent`-only math; keep the existing `useOptimistic`/`addSpend` block.)

- Update `handleAddExpense` so the add flow also bumps the actual total optimistically (the set-expense date uses `defaultExpenseDate`, which is inside the viewed month):

```tsx
  function handleAddExpense(data: { title: string; amount: number; category_id: string; date: string; notes?: string }) {
    startTransition(async () => {
      addSpend({ categoryId: data.category_id, amount: data.amount });
      setActualTotal((v) => v + data.amount);
      try {
        const result = await addExpense(data);
        if (result.error) {
          toast.error(result.error);
          setActualTotal((v) => v - data.amount);
        } else {
          toast.success("Expense added");
        }
      } catch {
        toast.error("Unable to add expense. Please try again.");
        setActualTotal((v) => v - data.amount);
      }
    });
    setExpenseForm(null);
  }
```

- [ ] **Step 4d: Client — four-card header**

Replace the whole `{/* Top Summary Cards */}` block (currently `statuses.length > 0 && grid grid-cols-1 sm:grid-cols-3`) with:

```tsx
      {/* Top Summary Cards */}
      {statuses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <FintechCard>
            <FintechCardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <Wallet className="h-5 w-5" />
                </div>
                <Badge variant="income">Total Target</Badge>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block">Total Budgeted</span>
                <CurrencyDisplay amount={totalBudgeted} className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground" />
              </div>
            </FintechCardContent>
          </FintechCard>

          <FintechCard>
            <FintechCardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <Badge variant="expense">All Expenses</Badge>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block">Total Actual Spending</span>
                <CurrencyDisplay amount={actualTotal} className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground" />
              </div>
            </FintechCardContent>
          </FintechCard>

          <FintechCard>
            <FintechCardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                  <PieChart className="h-5 w-5" />
                </div>
                <Badge variant="warning">Targeted</Badge>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block">Budgeted Spending</span>
                <CurrencyDisplay amount={totalBudgetedSpent} className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground" />
                <p className="text-xs text-muted-foreground tabular-nums">
                  {totalRemaining >= 0 ? `${formatCompactAmount(totalRemaining)} remaining allowance` : "Over allowance"}
                </p>
              </div>
            </FintechCardContent>
          </FintechCard>

          <FintechCard>
            <FintechCardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                  <Target className="h-5 w-5" />
                </div>
                <Badge variant="info">No Target</Badge>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground block">Unbudgeted Spending</span>
                <CurrencyDisplay amount={totalUnbudgetedSpent} className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground" />
                <p className="text-xs text-muted-foreground tabular-nums">categories without a budget target</p>
              </div>
            </FintechCardContent>
          </FintechCard>
        </div>
      )}
```

- Add `import { TrendingDown } from "lucide-react";` and `import { formatCompactAmount } from "@/lib/utils/currency";` (verify formatCompactAmount is exported from `@/lib/utils/currency` — in dashboard/page.tsx it is imported from there). Remove the now-unused `AlertTriangle` import only if unused elsewhere (it is unused after this change). Keep `Target`, `PieChart`, `Wallet`, `Calculator`, `Copy`, `Plus` as used.

- [ ] **Step 4e: Client — unbudgeted category cards**

Below the existing budgeted grid (inside the `statuses.length === 0 ? ... : (...)` ternary, after the budgeted grid `<div className="grid grid-cols-1 md:grid-cols-2 gap-5">...`), render a second section when `unbudgetedViews.length > 0`:

```tsx
          {unbudgetedViews.length > 0 && (
            <div className="space-y-4 mt-8">
              <div>
                <h3 className="font-semibold text-base text-foreground">Unbudgeted Categories</h3>
                <p className="text-xs text-muted-foreground">Spending in categories without a budget target this month.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {unbudgetedViews.map((view) => (
                  <FintechCard key={view.categoryId} className="space-y-4 border-dashed">
                    <FintechCardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-base">
                            {view.icon || "📦"}
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm text-foreground">{view.name}</h4>
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              No budget configured
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">Unbudgeted</Badge>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-1 border-t border-border/50">
                        <span className="text-muted-foreground">
                          Spent: <CurrencyDisplay amount={view.spent} className="font-bold text-foreground" />
                        </span>
                        <Button
                          onClick={() => setFormOpen(true)}
                          variant="outline"
                          className="rounded-xl h-9 text-xs"
                        >
                          <Target className="mr-1.5 h-4 w-4" /> Set Limit
                        </Button>
                      </div>
                    </FintechCardContent>
                  </FintechCard>
                ))}
              </div>
            </div>
          )}
```

Keep the outer conditional structure intact so `EmptyState` and the "Can I Afford This?" card still render.

- [ ] **Step 4f: Typecheck + lint**

Run: `npx tsc --noEmit` and `npm run lint`
Expected: PASS, no errors. Fix any unused import warnings.

- [ ] **Step 4g: Regression + full test run**

Run: `npx vitest run`
Expected: PASS (entire suite, including Task 1 regression identity and getBudgetStatuses goal-linked tests)

- [ ] **Step 4h: Commit**

```bash
git add "src/app/(dashboard)/budgets/page.tsx" "src/app/(dashboard)/budgets/budgets-page-client.tsx"
git commit -m "feat(budgets): split total into actual/budgeted/unbudgeted spending"
```

---

### Task 5: Production build + final verification

**Files:** none (verification only)

- [ ] **Step 5a: TypeScript**

Run: `npx tsc --noEmit`
Expected: EXIT 0

- [ ] **Step 5b: Lint**

Run: `npm run lint`
Expected: EXIT 0

- [ ] **Step 5c: Production build**

Run: `npm run build`
Expected: build completes with no errors

- [ ] **Step 5d: Full unit suite**

Run: `npx vitest run`
Expected: all files pass, including:
- `expense-aggregation.service.test.ts` (regression: total 7371 = budgeted 3389 + unbudgeted 3982, identity assertion)
- `financial.service.test.ts` (net-flow semantics + goal-linked budget spend preserved)
- `manila-time.test.ts` (date/timezone rules untouched)

- [ ] **Step 5e: Deliver the Final Audit Report**

Provide: Root cause; files changed; data flow (DB → query → shared aggregation → pages); before/after numbers; verification results. Do not commit unless asked.

## Self-Review

**Spec coverage:**
- Total Actual Spending vs Budgeted Spending vs Unbudgeted Spending — Task 1 (helpers + regression), Task 4 (header).
- Expenses page monthly total from shared source, no silent omission — Task 3 (removes `limit: 50` reduce undercount).
- Unbudgeted categories visible with "No budget configured" + Set Limit (existing BudgetForm, no auto-create) — Task 4e.
- Savings contribution meaning + `getMonthlySummary` untouched — Global Constraints + Task 2 preserves getBudgetStatuses semantics; getMonthlySummary not modified anywhere.
- Date boundaries (Aug 31 / Sep 1 / Sep 30 / Oct 1, Manila) — Task 1 boundary tests over `getMonthDateRange` gte/lte + existing manila-time tests.
- Cross-page propagation via existing actions/revalidation — untouched (Global Constraints).
- Regression identity pinned — Task 1 test asserts `totalActual === budgetedSpent + unbudgetedSpent` for the exact ₱7,371 scenario.

**Placeholder scan:** No TODOs/TBDs in tasks; all code shown.

**Type consistency:** `MonthlyExpenseAggregation` fields (`month`, `year`, `totalExpenses`, `expenseCount`, `byCategory`) used consistently across Tasks 1, 3, 4. `buildUnbudgetedCategoryViews` signature stable. `cachedGetMonthlyExpenseAggregation` matching `getMonthlyExpenseAggregation` params.