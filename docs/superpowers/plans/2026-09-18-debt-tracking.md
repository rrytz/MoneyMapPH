# Debt Tracking (negative goals) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add debt tracking to MoneyMap PH — debts as "negative goals" on the Savings page, with partial payments that book real expenses, a derived remaining balance, and an atomic pay/unpay flow, plus the bundled bugfix that makes `pay_bill`/`unpay_bill` regenerate monthly snapshots like every other money-visible action.

**Architecture:** A dedicated debts subsystem overlaid on the existing financial model. A pure derived-balance engine (`src/lib/utils/debt.ts`) computes remaining/progress/payoff/overdue; a service layer + cached wrapper feed the Savings page; payment+expense linking is atomic in two `SECURITY INVOKER` RPCs (`pay_debt`/`unpay_debt`) mirroring `pay_bill`/`unpay_bill`; server actions regenerate monthly snapshots and purge the full user financial cache. The snapshot fix lives in the same branch as a first-class task because leaving `pay_bill` divergent would make two structurally identical operations behave differently.

**Tech Stack:** Next 16 (Breaking-change conventions — see Global Constraints), React 19, Turbopack build, Supabase (Postgres RLS, RPC), zod validators, vitest, lucide-react, the existing FintechCard/CurrencyDisplay/Badge/Progress/Dialog vocabulary.

**Spec:** `docs/superpowers/specs/2026-09-18-debt-tracking-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

1. **Next 16, not the Next you know.** Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` before any page change. `searchParams`/`params` page props are **Promises**. This feature changes the Savings page (route file), which is a server component — follow the existing `savings/page.tsx` shape.
2. **Derived balance, never stored.** `remaining = total_amount − Σ payments`. No `remaining`/`status` column on `debts`.
3. **Overpay is impossible at the DB tier.** `pay_debt` computes remaining inside a `FOR UPDATE` transaction and raises `amount_exceeds_remaining`; the service additionally guards `updateDebt` against `total_amount < paid` (`TOTAL_BELOW_PAID`).
4. **Atomic pay/unpay.** `pay_debt` inserts the expense + payment in one transaction; `unpay_debt` deletes both. Never create or remove one without the other.
5. **`deleteDebt` = `deleteBill`** (confirmed parity): the DB cascades `debt_payments` on debt delete; linked `expenses` rows survive as ordinary history. Never delete linked expenses on debt delete.
6. **No seeding, no two-gate.** Debts are wholly user-created. No `handle_new_user` changes, no `ready`/`active` columns, no template rows.
7. **Snapshots on every money-visible write.** `payDebt`/`unpayDebt` AND the bundled `payBill`/`unpayBill` fix call `generateSnapshot(user, month, year)` for the payment's `paid_at` month. Month split: `const [yr, mo] = dateStr.split("-").map(Number)`.
8. **Revalidation on every debt mutation.** All debt actions: `revalidateUserFinancialCache(user.id)`. CRUD → `revalidatePath("/savings"|"/dashboard"|"/forecasting")`; pay/unpay → `revalidatePath("/savings"|"/expenses"|"/dashboard"|"/budgets"|"/transactions"|"/forecasting")`.
9. **Overlay guarantee.** Do not touch: `financial.service`, `forecast.service`, `snapshot.service` internals, budget services, Health Score math, `safe-to-spend.service`, `reminders` semantics, `NAV_ITEMS`, the `savings_goals` table or its `on_expense_contribution_change` trigger, payroll/income code except the bundled `payBill`/`unpayBill` fix, migrations 001–008.
10. **Migration 009 only.** New `supabase/migrations/009_debts_schema.sql`. Apply to cloud project `jaaeeyeyidvekzdssqfv` via the Management API (`SUPABASE_PAT_K2` env var; Database read-write scoped token from the user's store — never paste it into a file or chat).
11. **Amount typing.** Numeric-as-string (`string`) in `Debt`/`DebtPayment` types (mirrors `Bill`/`BillPayment`); `Number()` conversions live in the pure engine and service.
12. **Testing conventions.** Vitest for pure engine + mocked service (`src/tests/*.test.ts`). Gates (Task 7): `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`.
13. **Copy rules.** Section title "Payoff Debts"; buttons "+ New Debt", "Make Payment", "Record Payment"; badges "Paid Off" (`variant="info"`) and "Overdue" (`variant="expense"`). Delete-debt confirm text per spec §6.
14. **Commits.** Conventional `feat(debt): …` / `fix(bills): …` / `feat(verify): …`. Commit after each task's green gate. Only the storage layer (RPCs already) at Task 3 besides apply.

---

### Task 1: Pure payoff engine + types

**Files:**
- Create: `src/lib/utils/debt.ts`
- Modify: `src/lib/types/index.ts` (append Debt types after `BillsDueBy`, ~line 364)
- Test: `src/tests/debt.test.ts`

**Interfaces:**
- Consumes: `Debt`, `DebtPayment` types (defined in this task).
- Produces (used by Tasks 2–6):
  - `Debt { id: string; user_id: string; name: string; total_amount: string; due_date: string; category_id: string | null; notes: string | null; created_at: string; updated_at: string }`
  - `DebtPayment { id: string; debt_id: string; paid_at: string; amount: string; expense_id: string | null; created_at: string; updated_at: string }`
  - `DebtView { debts: Debt[]; payments: DebtPayment[] }`
  - `debtPaidOffAmount(payments: DebtPayment[]): number`
  - `debtRemaining(debt: Pick<Debt, "total_amount">, paid: number): number`
  - `debtProgress(debt: Pick<Debt, "total_amount">, paid: number): number`
  - `isDebtPaidOff(debt: Pick<Debt, "total_amount">, paid: number): boolean`
  - `isDebtOverdue(debt: Pick<Debt, "total_amount" | "due_date">, paid: number, today: string): boolean`

- [ ] **Step 1: Add the Debt types** — append to `src/lib/types/index.ts` after the `BillsDueBy` interface (line ~364):

```ts
export interface Debt {
  id: string;
  user_id: string;
  name: string;
  total_amount: string;
  due_date: string;
  category_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  paid_at: string;
  amount: string;
  expense_id: string | null;
  created_at: string;
  updated_at: string;
}

export type DebtView = {
  debts: Debt[];
  payments: DebtPayment[];
};
```

- [ ] **Step 2: Write the failing test** — `src/tests/debt.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  debtPaidOffAmount,
  debtRemaining,
  debtProgress,
  isDebtPaidOff,
  isDebtOverdue,
} from "@/lib/utils/debt";
import type { Debt, DebtPayment } from "@/lib/types";

const debt = (over: Partial<Debt> = {}): Debt => ({
  id: "d1",
  user_id: "u1",
  name: "Motorcycle Loan",
  total_amount: "20000",
  due_date: "2026-10-30",
  category_id: null,
  notes: null,
  created_at: "2026-09-18T00:00:00.000Z",
  updated_at: "2026-09-18T00:00:00.000Z",
  ...over,
});

const pay = (over: Partial<DebtPayment> = {}): DebtPayment => ({
  id: "p1",
  debt_id: "d1",
  paid_at: "2026-09-18",
  amount: "5000",
  expense_id: "e1",
  created_at: "2026-09-18T00:00:00.000Z",
  updated_at: "2026-09-18T00:00:00.000Z",
  ...over,
});

describe("debtPaidOffAmount", () => {
  it("returns 0 for no payments", () => {
    expect(debtPaidOffAmount([])).toBe(0);
  });
  it("sums partial payments to the cent", () => {
    expect(debtPaidOffAmount([pay(), pay({ amount: "1500.25" }), pay({ amount: "0.75" })])).toBe(6501);
  });
});

describe("debtRemaining", () => {
  it("is full total with no payments", () => {
    expect(debtRemaining(debt(), 0)).toBe(20000);
  });
  it("subtracts paid amount", () => {
    expect(debtRemaining(debt(), 5000)).toBe(15000);
  });
  it("floors at 0 on overpayment (defensive)", () => {
    expect(debtRemaining(debt(), 21000)).toBe(0);
  });
});

describe("debtProgress", () => {
  it("is 0 with nothing paid", () => {
    expect(debtProgress(debt(), 0)).toBe(0);
  });
  it("is paid / total", () => {
    expect(debtProgress(debt(), 5000)).toBeCloseTo(0.25);
  });
  it("clamps at 1 on overpayment", () => {
    expect(debtProgress(debt(), 20000)).toBe(1);
    expect(debtProgress(debt(), 25000)).toBe(1);
  });
  it("is 0 when total is 0 (defensive)", () => {
    expect(debtProgress(debt({ total_amount: "0" }), 100)).toBe(0);
  });
});

describe("isDebtPaidOff", () => {
  it("false while remaining", () => {
    expect(isDebtPaidOff(debt(), 5000)).toBe(false);
  });
  it("true when fully paid", () => {
    expect(isDebtPaidOff(debt(), 20000)).toBe(true);
  });
  it("true when overpaid (clamped)", () => {
    expect(isDebtPaidOff(debt(), 20500)).toBe(true);
  });
});

describe("isDebtOverdue", () => {
  const today = "2026-09-18";
  it("false before due date", () => {
    expect(isDebtOverdue(debt(), 0, "2026-09-18")).toBe(false);
  });
  it("false exactly on due date", () => {
    expect(isDebtOverdue(debt({ due_date: today }), 0, today)).toBe(false);
  });
  it("true after due date while remaining", () => {
    expect(isDebtOverdue(debt(), 5000, "2026-11-01")).toBe(true);
  });
  it("false after due date when paid off", () => {
    expect(isDebtOverdue(debt(), 20000, "2026-11-01")).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/tests/debt.test.ts`
Expected: FAIL — module `@/lib/utils/debt` not found.

- [ ] **Step 4: Write the implementation** — `src/lib/utils/debt.ts`

```ts
import type { Debt, DebtPayment } from "@/lib/types";

const toNum = (v: string): number => Number(v);

export function debtPaidOffAmount(payments: DebtPayment[]): number {
  return payments.reduce((sum, p) => sum + toNum(p.amount), 0);
}

export function debtRemaining(debt: Pick<Debt, "total_amount">, paid: number): number {
  return Math.max(0, toNum(debt.total_amount) - paid);
}

export function debtProgress(debt: Pick<Debt, "total_amount">, paid: number): number {
  const total = toNum(debt.total_amount);
  if (total <= 0) return 0;
  return Math.min(1, paid / total);
}

export function isDebtPaidOff(debt: Pick<Debt, "total_amount">, paid: number): boolean {
  return debtRemaining(debt, paid) === 0;
}

export function isDebtOverdue(
  debt: Pick<Debt, "total_amount" | "due_date">,
  paid: number,
  today: string
): boolean {
  return paid < toNum(debt.total_amount) && debt.due_date < today;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/tests/debt.test.ts`
Expected: PASS (all 5 describe blocks).

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/debt.ts src/lib/types/index.ts src/tests/debt.test.ts
git commit -m "feat(debt): pure payoff engine + types"
```

---

### Task 2: Service layer + cache tag + typed validators

**Files:**
- Create: `src/lib/services/debt.service.ts`
- Modify: `src/lib/cache/tags.ts` (add `"debts"` suffix)
- Modify: `src/lib/cache/shared-queries.ts` (add `cachedGetDebts`)
- Modify: `src/lib/utils/validators.ts` (append debt schemas)
- Test: `src/tests/debt.service.test.ts`

**Interfaces:**
- Consumes: `Debt`, `DebtPayment`, `DebtView` (Task 1); `debtPaidOffAmount` (Task 1).
- Produces (used by Tasks 4–6):
  - `type DebtInput = { name: string; total_amount: number; due_date: string; category_id?: string | null; notes?: string | null }`
  - `getDebts(supabase: SupabaseClient, userId: string): Promise<DebtView>`
  - `createDebt(supabase: SupabaseClient, userId: string, input: DebtInput): Promise<Debt>`
  - `updateDebt(supabase: SupabaseClient, userId: string, id: string, patch: Partial<DebtInput>): Promise<Debt>` — throws `Error("TOTAL_BELOW_PAID")` when a new `total_amount < paid_total`
  - `deleteDebt(supabase: SupabaseClient, userId: string, id: string): Promise<void>`
  - `getDebtPayment(supabase: SupabaseClient, userId: string, paymentId: string): Promise<DebtPayment | null>` — `null` when not found or not owned
  - `cachedGetDebts(supabase: SupabaseClient, userId: string): Promise<DebtView>`
  - `debtInputSchema`, `payDebtSchema`, `unpayDebtSchema` (zod, shapes in Global Constraint context below)
  - Types `DebtInputSchemaType`, `PayDebtSchemaType`, `UnpayDebtSchemaType`

- [ ] **Step 1: Register the cache tag** — `src/lib/cache/tags.ts`, add `"debts"` to `FINANCIAL_TAG_SUFFIXES` (after `"bills"`). It stays **out** of `USER_SCOPED_SUFFIXES` (like `"goals"`) so it carries the global umbrella tag.

```ts
export const FINANCIAL_TAG_SUFFIXES = [
  "summary",
  "budgets",
  "snapshots",
  "categories",
  "sources",
  "goals",
  "paychecks",
  "lean",
  "safe-to-spend",
  "bills",
  "debts",
] as const;
```

- [ ] **Step 2: Write the failing test** — `src/tests/debt.service.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import {
  getDebts,
  createDebt,
  updateDebt,
  deleteDebt,
  getDebtPayment,
} from "@/lib/services/debt.service";

type Row = Record<string, unknown>;

function clientStub(rows: Record<string, Row[]>) {
  const calls: string[] = [];
  const build = (table: string, filters: Row): any => {
    const matches = (r: Row) =>
      Object.entries(filters).every(([k, v]) => v === undefined || r[k] === v);
    const list = () => (rows[table] ?? []).filter(matches);
    const q: any = {
      eq: (k: string, v: unknown) => {
        calls.push(`eq:${k}=${v}`);
        return build(table, { ...filters, [k]: v });
      },
      order: (k: string) => {
        calls.push(`order:${k}`);
        return q;
      },
      in: (k: string, v: string[]) => {
        calls.push(`in:${k}=${v.length}`);
        return q;
      },
      select: () => q,
      maybeSingle: async () => ({ data: list()[0] ?? null, error: null }),
      single: async () => ({ data: list()[0] ?? null, error: null }),
      insert: () => {
        calls.push(`insert:${table}`);
        return q;
      },
      update: (_patch: unknown) => {
        calls.push(`update:${table}`);
        return q;
      },
      delete: () => {
        calls.push(`delete:${table}`);
        return q;
      },
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: list(), error: null }).then(resolve),
    };
    return q;
  };
  return {
    from: (t: string) => {
      calls.push(`from:${t}`);
      return build(t, {});
    },
    calls,
  };
}

describe("getDebts", () => {
  it("returns debts + payments for the user, debts ordered by due_date", async () => {
    const rows = {
      debts: [
        { id: "d1", user_id: "u1", total_amount: "20000", due_date: "2026-10-30" },
        { id: "d2", user_id: "u2", total_amount: "100", due_date: "2026-09-01" },
      ],
      debt_payments: [{ id: "p1", debt_id: "d1", amount: "5000", paid_at: "2026-09-18" }],
    };
    const s = clientStub(rows) as never;
    const view = await getDebts(s, "u1");
    expect(view.debts.map((d) => d.id)).toEqual(["d1"]);
    expect(view.payments).toHaveLength(1);
    expect((s as unknown as { calls: string[] }).calls).toContain("from:debt_payments");
  });

  it("skips the payments query entirely when the user has no debts", async () => {
    const rows = { debts: [{ id: "d9", user_id: "ux" }], debt_payments: [] };
    const s = clientStub(rows) as never;
    const view = await getDebts(s, "u1");
    expect(view.debts).toHaveLength(0);
    expect(view.payments).toEqual([]);
    expect((s as unknown as { calls: string[] }).calls.filter((c) => c === "from:debt_payments")).toHaveLength(0);
  });
});

describe("createDebt", () => {
  it("inserts a user-scoped debt", async () => {
    const rows = { debts: [] };
    const s = clientStub(rows) as never;
    await expect(
      createDebt(s, "u1", { name: "Loan", total_amount: 20000, due_date: "2026-10-30", category_id: null, notes: null })
    ).resolves.toBeDefined();
  });
});

describe("updateDebt", () => {
  it("rejects a total below the already-paid sum", async () => {
    const rows = {
      debts: [],
      debt_payments: [
        { id: "p1", debt_id: "d1", amount: "5000" },
        { id: "p2", debt_id: "d1", amount: "7000" },
      ],
    };
    const s = clientStub(rows) as never;
    await expect(updateDebt(s, "u1", "d1", { total_amount: 10000 })).rejects.toThrow("TOTAL_BELOW_PAID");
  });

  it("allows a total above the paid sum", async () => {
    const rows = { debts: [], debt_payments: [{ id: "p1", debt_id: "d1", amount: "3000" }] };
    const s = clientStub(rows) as never;
    await expect(updateDebt(s, "u1", "d1", { total_amount: 15000 })).resolves.toBeDefined();
  });
});

describe("deleteDebt", () => {
  it("issues a user-scoped delete", async () => {
    const rows = { debts: [] };
    const s = clientStub(rows) as never;
    await deleteDebt(s, "u1", "d1");
    expect((s as unknown as { calls: string[] }).calls).toContain("eq:id=d1");
    expect((s as unknown as { calls: string[] }).calls).toContain("eq:user_id=u1");
  });
});

describe("getDebtPayment", () => {
  it("returns null when the payment is not owned", async () => {
    const rows = {
      debt_payments: [{ id: "p1", debt_id: "d1", paid_at: "2026-09-18", amount: "5000" }],
      debts: [{ id: "d2", user_id: "uX" }],
    };
    const s = clientStub(rows) as never;
    await expect(getDebtPayment(s, "u1", "p1")).resolves.toBeNull();
  });

  it("returns the payment when owned", async () => {
    const rows = {
      debt_payments: [{ id: "p1", debt_id: "d1", paid_at: "2026-09-18", amount: "5000" }],
      debts: [{ id: "d1", user_id: "u1" }],
    };
    const s = clientStub(rows) as never;
    const p = await getDebtPayment(s, "u1", "p1");
    expect(p?.paid_at).toBe("2026-09-18");
  });

  it("returns null when the payment row does not exist", async () => {
    const s = clientStub({ debt_payments: [], debts: [] }) as never;
    await expect(getDebtPayment(s, "u1", "nope")).resolves.toBeNull();
  });
});
```

> The stub above mirrors the query chains the implementation uses. If a later gate run complains about the stub's call assertions, adjust the `calls` expectations to match the queries, not the other way around — the real Supabase client is exercised in Task 8.

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/tests/debt.service.test.ts`
Expected: FAIL — module `@/lib/services/debt.service` not found.

- [ ] **Step 4: Write the implementation** — `src/lib/services/debt.service.ts`

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { Debt, DebtPayment, DebtView } from "@/lib/types";

export type DebtInput = {
  name: string;
  total_amount: number;
  due_date: string;
  category_id?: string | null;
  notes?: string | null;
};

export async function getDebts(supabase: SupabaseClient, userId: string): Promise<DebtView> {
  const { data: debts, error: e1 } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true });
  if (e1) throw e1;

  const list = (debts || []) as Debt[];
  let payments: DebtPayment[] = [];
  if (list.length > 0) {
    const { data: all, error: e2 } = await supabase
      .from("debt_payments")
      .select("*")
      .in(
        "debt_id",
        list.map((d) => d.id)
      )
      .order("paid_at", { ascending: true });
    if (e2) throw e2;
    payments = (all || []) as DebtPayment[];
  }

  return { debts: list, payments };
}

export async function createDebt(
  supabase: SupabaseClient,
  userId: string,
  input: DebtInput
): Promise<Debt> {
  const { data, error } = await supabase
    .from("debts")
    .insert({
      user_id: userId,
      name: input.name,
      total_amount: input.total_amount,
      due_date: input.due_date,
      category_id: input.category_id ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Debt;
}

export async function updateDebt(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<DebtInput>
): Promise<Debt> {
  if (patch.total_amount !== undefined) {
    const { data: payments } = await supabase
      .from("debt_payments")
      .select("amount")
      .eq("debt_id", id);
    const paid = (payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    if (patch.total_amount < paid) throw new Error("TOTAL_BELOW_PAID");
  }

  const { data, error } = await supabase
    .from("debts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return data as Debt;
}

export async function deleteDebt(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase.from("debts").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function getDebtPayment(
  supabase: SupabaseClient,
  userId: string,
  paymentId: string
): Promise<DebtPayment | null> {
  const { data: payment, error } = await supabase
    .from("debt_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw error;
  if (!payment) return null;

  const { data: debt } = await supabase
    .from("debts")
    .select("id")
    .eq("id", (payment as DebtPayment).debt_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!debt) return null;

  return payment as DebtPayment;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/tests/debt.service.test.ts`
Expected: PASS. Adjust the stub's `calls` assertions to the real query chains if a specific expectation mismatches (the queries above are the source of truth).

- [ ] **Step 6: Add the cached wrapper** — `src/lib/cache/shared-queries.ts`, after `cachedGetSavingsGoals` (line ~107). First add imports: `import { getDebts } from "@/lib/services/debt.service";` and `import type { DebtView } from "@/lib/types";`

```ts
export const cachedGetDebts = (
  supabase: SupabaseClient,
  userId: string
): Promise<DebtView> =>
  unstable_cache(
    async () => getDebts(supabase, userId),
    ["debts", userId],
    { revalidate: REVALIDATE_SECONDS, tags: buildFinancialTags(userId, "debts") }
  )();
```

- [ ] **Step 7: Add the validators** — `src/lib/utils/validators.ts`, append after `unpayBillSchema` (line ~129):

```ts
export const debtInputSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  total_amount: z.coerce.number().positive("Amount must be greater than 0").max(999999999999, "Amount is too large"),
  due_date: z.string().min(1, "Due date is required"),
  category_id: z.string().uuid("Select a category").optional().or(z.literal("")),
  notes: z.string().max(500, "Notes must be 500 characters or less").optional().or(z.literal("")),
});

export const payDebtSchema = z.object({
  debtId: z.string().uuid("Select a debt"),
  paidAt: z.string().min(1, "Paid date is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0").max(999999999999, "Amount is too large"),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const unpayDebtSchema = z.object({
  paymentId: z.string().uuid(),
});

export type DebtInputSchemaType = z.infer<typeof debtInputSchema>;
export type PayDebtSchemaType = z.infer<typeof payDebtSchema>;
export type UnpayDebtSchemaType = z.infer<typeof unpayDebtSchema>;
```

- [ ] **Step 8: Full test run**

Run: `npx vitest run`
Expected: ALL PASS (existing suites still green + new debt suites).

- [ ] **Step 9: Commit**

```bash
git add src/lib/services/debt.service.ts src/lib/cache/tags.ts src/lib/cache/shared-queries.ts src/lib/utils/validators.ts src/tests/debt.service.test.ts
git commit -m "feat(debt): service layer, cache tag, typed validators"
```

---

### Task 3: Schema migration 009 + apply + verify (cloud)

**Files:**
- Create: `supabase/migrations/009_debts_schema.sql`

**Interfaces:**
- Produces (used by Tasks 4, 6, 8): tables `public.debts`, `public.debt_payments`; RPCs `pay_debt(...)` and `unpay_debt(p_payment_id)`.

- [ ] **Step 1: Write the migration** — `supabase/migrations/009_debts_schema.sql`

```sql
-- ============================================================
-- DEBTS SCHEMA (negative goals)
-- Tables, RLS, RPCs. No seeding — debts are wholly user-created.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  due_date DATE NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debts_user ON public.debts(user_id);
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own debts" ON public.debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debts" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON public.debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON public.debts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  paid_at DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (expense_id)
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON public.debt_payments(debt_id, paid_at);
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own debt payments" ON public.debt_payments
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));
CREATE POLICY "Users can insert own debt payments" ON public.debt_payments
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));
CREATE POLICY "Users can update own debt payments" ON public.debt_payments
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));
CREATE POLICY "Users can delete own debt payments" ON public.debt_payments
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.debt_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------
-- RPC: pay_debt — log an expense + payment atomically, with an
-- overpay guard computed inside the transaction (FOR UPDATE).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_debt(
  p_debt_id uuid,
  p_paid_at date,
  p_category_id uuid,
  p_amount numeric,
  p_notes text DEFAULT NULL
) RETURNS public.debt_payments
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_debt public.debts%ROWTYPE;
  v_remaining numeric;
  v_expense_id uuid;
  v_result public.debt_payments%ROWTYPE;
  v_resolved_category_id uuid;
BEGIN
  SELECT * INTO v_debt FROM public.debts WHERE id = p_debt_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'debt_not_found'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount_invalid'; END IF;

  v_remaining := v_debt.total_amount - COALESCE(
    (SELECT SUM(amount) FROM public.debt_payments WHERE debt_id = p_debt_id), 0
  );
  IF p_amount > v_remaining THEN RAISE EXCEPTION 'amount_exceeds_remaining'; END IF;

  v_resolved_category_id := COALESCE(
    p_category_id,
    v_debt.category_id,
    (SELECT id FROM public.expense_categories ec
      WHERE ec.user_id = auth.uid() AND ec.is_default
      ORDER BY ec.sort_order, ec.id LIMIT 1)
  );
  IF v_resolved_category_id IS NULL THEN
    RAISE EXCEPTION 'category_required';
  END IF;

  INSERT INTO public.expenses (user_id, title, amount, category_id, date, notes)
  VALUES (auth.uid(), v_debt.name, p_amount, v_resolved_category_id, p_paid_at, p_notes)
  RETURNING id INTO v_expense_id;

  INSERT INTO public.debt_payments (debt_id, paid_at, amount, expense_id)
  VALUES (p_debt_id, p_paid_at, p_amount, v_expense_id)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- ------------------------------------------------------------
-- RPC: unpay_debt — remove payment AND its linked expense atomically
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unpay_debt(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_expense_id uuid;
  v_owned boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.debt_payments dp
    JOIN public.debts d ON d.id = dp.debt_id
    WHERE dp.id = p_payment_id AND d.user_id = auth.uid()
  ) INTO v_owned;
  IF NOT v_owned THEN RAISE EXCEPTION 'payment_not_found'; END IF;

  SELECT expense_id INTO v_expense_id FROM public.debt_payments WHERE id = p_payment_id;

  DELETE FROM public.debt_payments WHERE id = p_payment_id;
  IF v_expense_id IS NOT NULL THEN
    DELETE FROM public.expenses WHERE id = v_expense_id AND user_id = auth.uid();
  END IF;
END;
$$;
```

- [ ] **Step 2: Guard the credential**

Run: `if (-not $env:SUPABASE_PAT_K2) { Write-Error "Set SUPABASE_PAT_K2 first (scoped token, Database read-write, from the user's store)" }`
Expected: no error.

- [ ] **Step 3: Apply via Management API** (008 pattern — body `{ name, query }` to `POST /v1/projects/jaaeeyeyidvekzdssqfv/database/migrations`; pass SQL as a file to `curl.exe -d @file`):

```powershell
$body = @{ name = "009_debts_schema"; query = (Get-Content -Raw -LiteralPath "supabase/migrations/009_debts_schema.sql") } | ConvertTo-Json -Compress
Set-Content -LiteralPath "$env:TEMP\opencode\migrate-009.json" -Value $body -Encoding UTF8
curl.exe -s -o "$env:TEMP\opencode\migrate-009-out.json" -w "%{http_code}" `
  "https://api.supabase.com/v1/projects/jaaeeyeyidvekzdssqfv/database/migrations" `
  -H "Authorization: Bearer $env:SUPABASE_PAT_K2" -H "Content-Type: application/json" `
  -d "@$env:TEMP\opencode\migrate-009.json"
```

Expected: HTTP 201. On failure, read the response body and fix the SQL before retrying.

- [ ] **Step 4: Verify schema + RLS + functions** via `POST /v1/projects/jaaeeyeyidvekzdssqfv/database/query`:

Query 1 — tables/columns:

```sql
SELECT table_name, column_name, is_nullable FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('debts','debt_payments')
ORDER BY table_name, ordinal_position;
```

Expected: `debts` (`total_amount` NOT NULL, `due_date` NOT NULL), `debt_payments` (`amount` NOT NULL, `paid_at` NOT NULL, `expense_id` nullable).

Query 2 — RLS:

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('debts','debt_payments');
```

Expected: `true` for both.

Query 3 — functions:

```sql
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('pay_debt','unpay_debt');
```

Expected: both rows present.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/009_debts_schema.sql
git commit -m "feat(debt): 009 debts schema + pay/unpay RPCs"
```

Note in the commit body: `apply: Management API POST /database/migrations → HTTP 201`.

---

### Task 4: Server actions (CRUD + pay + unpay)

**Files:**
- Modify: `src/app/(dashboard)/savings/actions.ts` (append)

**Interfaces:**
- Consumes: `createDebt`, `updateDebt`, `deleteDebt`, `getDebtPayment` (Task 2); `debtInputSchema`, `payDebtSchema`, `unpayDebtSchema` + their inferred types (Task 2); `generateSnapshot` from `@/lib/services/snapshot.service`; `revalidateUserFinancialCache` from `@/lib/cache/tags`.
- Produces (used by Task 6):
  - `addDebt(formData: DebtInputSchemaType): Promise<{ success: boolean; error?: string }>`
  - `editDebt(debtId: string, formData: DebtInputSchemaType): Promise<{ success: boolean; error?: string }>`
  - `removeDebt(debtId: string): Promise<{ success: boolean; error?: string }>`
  - `payDebt(formData: PayDebtSchemaType): Promise<{ success: boolean; error?: string }>`
  - `unpayDebt(input: UnpayDebtSchemaType): Promise<{ success: boolean; error?: string }>`

- [ ] **Step 1: Extend the import block — `src/app/(dashboard)/savings/actions.ts`**

Replace the imports at the top with:

```ts
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  addGoalContribution,
} from "@/lib/services/goal.service";
import {
  createDebt,
  updateDebt,
  deleteDebt,
  getDebtPayment,
} from "@/lib/services/debt.service";
import { generateSnapshot } from "@/lib/services/snapshot.service";
import { revalidateUserFinancialCache } from "@/lib/cache/tags";
import {
  savingsGoalSchema,
  contributionSchema,
  debtInputSchema,
  payDebtSchema,
  unpayDebtSchema,
  type DebtInputSchemaType,
  type PayDebtSchemaType,
  type UnpayDebtSchemaType,
} from "@/lib/utils/validators";
```

- [ ] **Step 2: Append the CRUD actions**

```ts
export async function addDebt(formData: DebtInputSchemaType) {
  const parsed = debtInputSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await createDebt(supabase, user.id, {
      name: parsed.data.name,
      total_amount: parsed.data.total_amount,
      due_date: parsed.data.due_date,
      category_id: parsed.data.category_id || null,
      notes: parsed.data.notes || null,
    });
    revalidateUserFinancialCache(user.id);
    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to create debt:", err);
    return { error: "Unable to create debt. Please verify your inputs." };
  }
}

export async function editDebt(debtId: string, formData: DebtInputSchemaType) {
  const parsed = debtInputSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await updateDebt(supabase, user.id, debtId, {
      name: parsed.data.name,
      total_amount: parsed.data.total_amount,
      due_date: parsed.data.due_date,
      category_id: parsed.data.category_id || null,
      notes: parsed.data.notes || null,
    });
    revalidateUserFinancialCache(user.id);
    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to update debt:", err);
    const message =
      err instanceof Error && err.message === "TOTAL_BELOW_PAID"
        ? "Total amount can't be less than what's already paid off."
        : "Unable to update debt. Please try again.";
    return { error: message };
  }
}

export async function removeDebt(debtId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await deleteDebt(supabase, user.id, debtId);
    revalidateUserFinancialCache(user.id);
    revalidatePath("/savings");
    revalidatePath("/dashboard");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to delete debt:", err);
    return { error: "Unable to delete debt. Please try again." };
  }
}
```

- [ ] **Step 3: Append the pay + unpay actions** (snapshot regeneration + full money-surface revalidation):

```ts
export async function payDebt(formData: PayDebtSchemaType) {
  const parsed = payDebtSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const { error } = await supabase.rpc("pay_debt", {
      p_debt_id: parsed.data.debtId,
      p_paid_at: parsed.data.paidAt,
      p_category_id: parsed.data.categoryId || null,
      p_amount: parsed.data.amount,
      p_notes: parsed.data.notes || null,
    });
    if (error) {
      if (error.message.includes("amount_exceeds_remaining")) return { error: "Payment exceeds the remaining balance." };
      if (error.message.includes("debt_not_found")) return { error: "Debt not found." };
      if (error.message.includes("amount_invalid")) return { error: "Payment amount must be greater than 0." };
      if (error.message.includes("category_required")) return { error: "Pick an expense category." };
      return { error: "Could not log payment. Please try again." };
    }

    const [yr, mo] = parsed.data.paidAt.split("-").map(Number);
    await generateSnapshot(supabase, user.id, mo, yr);
    revalidateUserFinancialCache(user.id);
    revalidatePath("/savings");
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/budgets");
    revalidatePath("/transactions");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to log debt payment:", err);
    return { error: "Unable to log payment. Please try again." };
  }
}

export async function unpayDebt(input: UnpayDebtSchemaType) {
  const parsed = unpayDebtSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid payment" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const payment = await getDebtPayment(supabase, user.id, parsed.data.paymentId);
    if (!payment) return { error: "Payment not found." };

    const [yr, mo] = payment.paid_at.split("-").map(Number);
    const { error } = await supabase.rpc("unpay_debt", { p_payment_id: parsed.data.paymentId });
    if (error) {
      if (error.message.includes("payment_not_found")) return { error: "Payment not found." };
      return { error: "Could not undo payment. Please try again." };
    }

    await generateSnapshot(supabase, user.id, mo, yr);
    revalidateUserFinancialCache(user.id);
    revalidatePath("/savings");
    revalidatePath("/expenses");
    revalidatePath("/dashboard");
    revalidatePath("/budgets");
    revalidatePath("/transactions");
    revalidatePath("/forecasting");
    return { success: true };
  } catch (err) {
    console.error("Failed to undo debt payment:", err);
    return { error: "Unable to undo payment. Please try again." };
  }
}
```

- [ ] **Step 4: Local gates**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no new warnings/errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/savings/actions.ts
git commit -m "feat(debt): server actions with snapshot regeneration"
```

---

### Task 5: Bundled K2 fix — `payBill`/`unpayBill` snapshot regeneration

**Files:**
- Modify: `src/app/(dashboard)/income/bills/actions.ts` (payBill + unpayBill)

**Interfaces:**
- Consumes: `generateSnapshot` from `@/lib/services/snapshot.service` (already-depended pattern in the repo).
- Produces: nothing downstream — restores invariant "every expense-creating action regenerates the snapshot for the touched month".

- [ ] **Step 1: Add the import**

```ts
import { generateSnapshot } from "@/lib/services/snapshot.service";
```

- [ ] **Step 2: Modify `payBill`** — after the RPC error block (line ~33), insert the snapshot regeneration, and extend the revalidation set. The function body becomes:

```ts
  if (error) {
    if (error.message.includes("bill_not_ready")) return { error: "This bill is paused or incomplete." };
    if (error.message.includes("duplicate") || error.code === "23505") return { error: "This occurrence is already paid." };
    return { error: "Could not log payment. Please try again." };
  }

  const [yr, mo] = parsed.data.paidAt.split("-").map(Number);
  await generateSnapshot(supabase, user.id, mo, yr);

  revalidateUserFinancialCache(user.id);
  revalidatePath("/income");
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  revalidatePath("/transactions");
  revalidatePath("/forecasting");
  return {};
}
```

- [ ] **Step 3: Modify `unpayBill`** — pre-fetch `paid_at` before the RPC (returns void), regenerate after, and extend the revalidation set:

```ts
export async function unpayBill(input: z.infer<typeof unpayBillSchema>): Promise<ActionResult> {
  const parsed = unpayBillSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid payment" };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not signed in" };

  const { data: payment } = await supabase
    .from("bill_payments")
    .select("paid_at")
    .eq("id", parsed.data.paymentId)
    .maybeSingle();
  if (!payment) return { error: "Payment not found." };

  const [yr, mo] = payment.paid_at.split("-").map(Number);

  const { error } = await supabase.rpc("unpay_bill", { p_payment_id: parsed.data.paymentId });
  if (error) return { error: "Could not undo payment. Please try again." };

  await generateSnapshot(supabase, user.id, mo, yr);

  revalidateUserFinancialCache(user.id);
  revalidatePath("/income");
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  revalidatePath("/transactions");
  revalidatePath("/forecasting");
  return {};
}
```

> `bill_payments.paid_at` is `DATE NOT NULL`, so the row always yields the month to regenerate.

- [ ] **Step 4: Local gates**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/income/bills/actions.ts
git commit -m "fix(bills): regenerate snapshots on pay/unpay"
```

Body note: `Bundled with debt tracking per the K2 snapshot audit — pay and unpay now behave like every expense-creating action (income/expenses/budgets already regenerate).`

---

### Task 6: Savings page — Payoff Debts section

**Files:**
- Modify: `src/app/(dashboard)/savings/page.tsx`
- Modify: `src/app/(dashboard)/savings/savings-page-client.tsx`

**Interfaces:**
- Consumes: `cachedGetDebts` (Task 2), `Debt`/`DebtPayment` types, all five `debt` helpers (Task 1), actions `addDebt`/`editDebt`/`removeDebt`/`payDebt`/`unpayDebt` (Task 4).
- Produces: the `Payoff Debts` section on `/savings` + new client props (`initialDebts: Debt[]`, `debtPayments: DebtPayment[]`).

- [ ] **Step 1: Wire the server page — `src/app/(dashboard)/savings/page.tsx`**

Replace the imports and body:

```tsx
import { createClient, getUser } from "@/lib/supabase/server";
import { cachedGetSavingsGoals as getSavingsGoals } from "@/lib/cache/shared-queries";
import { cachedGetExpenseCategories as getExpenseCategories } from "@/lib/cache/shared-queries";
import { cachedGetSnapshots as getSnapshots } from "@/lib/cache/shared-queries";
import { cachedGetDebts as getDebts } from "@/lib/cache/shared-queries";
import { calculateEmergencyFundStatus } from "@/lib/services/forecast.service";
import { SavingsPageClient } from "./savings-page-client";
import { redirect } from "next/navigation";

export default async function SavingsPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const [goals, categories, snapshots, debtView] = await Promise.all([
    getSavingsGoals(supabase, user.id),
    getExpenseCategories(supabase, user.id),
    getSnapshots(supabase, user.id, 6),
    getDebts(supabase, user.id),
  ]);

  const emergencyStatus = await calculateEmergencyFundStatus(supabase, user.id, {
    goals,
    snapshots,
  });

  return (
    <SavingsPageClient
      initialGoals={goals}
      categories={categories}
      emergencyStatus={emergencyStatus}
      initialDebts={debtView.debts}
      debtPayments={debtView.payments}
    />
  );
}
```

- [ ] **Step 2: Extend the client imports** — `savings-page-client.tsx`

Replace the import block (lines 1–34) with:

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  PiggyBank,
  Shield,
  Trash2,
  Calendar,
  Pencil,
  Sparkles,
  ArrowUpRight,
  Target,
  Wallet,
  CircleDollarSign,
  HandCoins,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { addGoal, editGoal, removeGoal, recordContribution, addDebt, editDebt, removeDebt, payDebt, unpayDebt } from "./actions";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { debtPaidOffAmount, debtRemaining, debtProgress, isDebtPaidOff, isDebtOverdue } from "@/lib/utils/debt";
import type { SavingsGoal, ExpenseCategory, Debt, DebtPayment } from "@/lib/types";
import type { EmergencyFundStatus } from "@/lib/services/forecast.service";
```

- [ ] **Step 3: Extend props + state**

```tsx
interface SavingsPageClientProps {
  initialGoals: SavingsGoal[];
  categories: ExpenseCategory[];
  emergencyStatus: EmergencyFundStatus;
  initialDebts: Debt[];
  debtPayments: DebtPayment[];
}

export function SavingsPageClient({
  initialGoals,
  categories,
  emergencyStatus,
  initialDebts,
  debtPayments,
}: SavingsPageClientProps) {
  const goals = initialGoals;
  const debts = initialDebts;
```

Add after the existing contribution-form state (after `contribNotes`, line ~64):

```tsx
  // Debt Form State
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [debtDeleteId, setDebtDeleteId] = useState<string | null>(null);
  const [deletingDebt, setDeletingDebt] = useState(false);

  const [debtName, setDebtName] = useState("");
  const [debtTotal, setDebtTotal] = useState("");
  const [debtDueDate, setDebtDueDate] = useState("");
  const [debtCategory, setDebtCategory] = useState("");
  const [debtNotes, setDebtNotes] = useState("");

  // Payment Form State
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payCategory, setPayCategory] = useState("");
  const [payNotes, setPayNotes] = useState("");
```

- [ ] **Step 4: Add the debt/payment handlers** — after `handleDelete` (line ~173):

```tsx
  function openNewDebtModal() {
    setSelectedDebt(null);
    setDebtName("");
    setDebtTotal("");
    setDebtDueDate("");
    setDebtCategory("");
    setDebtNotes("");
    setDebtModalOpen(true);
  }

  function openEditDebtModal(debt: Debt) {
    setSelectedDebt(debt);
    setDebtName(debt.name);
    setDebtTotal(Number(debt.total_amount).toString());
    setDebtDueDate(debt.due_date);
    setDebtCategory(debt.category_id || "");
    setDebtNotes(debt.notes || "");
    setDebtModalOpen(true);
  }

  function openPayModal(debt: Debt) {
    setSelectedDebt(debt);
    setPayAmount("");
    setPayDate(new Date().toISOString().split("T")[0]);
    const fallback = categories.find((c) =>
      c.name.toLowerCase().includes("savings") || c.name.toLowerCase().includes("emergency")
    ) || categories[0];
    setPayCategory(debt.category_id || fallback?.id || "");
    setPayNotes("");
    setPayModalOpen(true);
  }

  async function handleDebtSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!debtName || !debtTotal || !debtDueDate) {
      toast.error("Please fill in required fields.");
      return;
    }

    startTransition(async () => {
      const payload = {
        name: debtName,
        total_amount: Number(debtTotal),
        due_date: debtDueDate,
        category_id: debtCategory || undefined,
        notes: debtNotes || undefined,
      };

      const res = selectedDebt
        ? await editDebt(selectedDebt.id, payload)
        : await addDebt(payload);

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(selectedDebt ? "Debt updated" : "Debt created");
        setDebtModalOpen(false);
      }
    });
  }

  async function handlePaySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDebt || !payAmount || !payCategory) {
      toast.error("Please fill in required fields.");
      return;
    }

    startTransition(async () => {
      const res = await payDebt({
        debtId: selectedDebt.id,
        paidAt: payDate,
        amount: Number(payAmount),
        categoryId: payCategory,
        notes: payNotes || undefined,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Recorded ₱${payAmount} payment on ${selectedDebt.name}`);
        setPayModalOpen(false);
      }
    });
  }

  async function handleUnpay(paymentId: string) {
    startTransition(async () => {
      const res = await unpayDebt({ paymentId });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Payment undone");
      }
    });
  }

  async function handleDebtDelete() {
    if (!debtDeleteId) return;
    setDeletingDebt(true);
    const res = await removeDebt(debtDeleteId);
    setDeletingDebt(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Debt deleted successfully");
    }
    setDebtDeleteId(null);
  }
```

- [ ] **Step 5: Add the Debts section JSX** — immediately after the Goals grid block closes (after line ~376, `)}` followed by the blank line before `{/* Add / Edit Goal Dialog */}`):

```tsx
      {/* Payoff Debts Section */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <CircleDollarSign className="h-4 w-4" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Payoff Debts</h3>
          </div>
          <Button onClick={openNewDebtModal} className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs px-4 h-9 cursor-pointer">
            <Plus className="mr-1.5 h-4 w-4" /> New Debt
          </Button>
        </div>

        {debts.length === 0 ? (
          <EmptyState
            icon={<CircleDollarSign className="h-6 w-6" />}
            title="No Debts Tracked"
            description="Add loans, credit balances, or personal debts to track payoff progress."
            actionLabel="Add First Debt"
            onAction={openNewDebtModal}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {debts.map((debt) => {
              const paid = debtPaidOffAmount(debtPayments.filter((p) => p.debt_id === debt.id));
              const remaining = debtRemaining(debt, paid);
              const progress = debtProgress(debt, paid);
              const paidOff = isDebtPaidOff(debt, paid);
              const overdue = isDebtOverdue(debt, paid, new Date().toISOString().split("T")[0]);
              const history = debtPayments
                .filter((p) => p.debt_id === debt.id)
                .sort((a, b) => a.paid_at.localeCompare(b.paid_at));

              return (
                <FintechCard
                  key={debt.id}
                  className="relative overflow-hidden transition-all duration-200 border-rose-200/70 dark:border-rose-900/40"
                >
                  <FintechCardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-foreground truncate max-w-[200px]">{debt.name}</h4>
                          {paidOff && (
                            <Badge variant="info" className="text-[10px]">
                              <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Paid Off
                            </Badge>
                          )}
                          {overdue && (
                            <Badge variant="expense" className="text-[10px]">
                              <Calendar className="h-2.5 w-2.5 mr-0.5" /> Overdue
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1 font-medium">
                          <Calendar className="h-3 w-3" /> Due: {formatDate(debt.due_date, "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDebtModal(debt)} className="h-8 w-8 text-slate-500">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDebtDeleteId(debt.id)} className="h-8 w-8 text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex justify-between items-baseline pt-1">
                      <div>
                        <span className="text-xs text-muted-foreground font-medium">Remaining Balance</span>
                        <CurrencyDisplay amount={remaining} className="text-2xl font-bold block text-rose-600 dark:text-rose-400" />
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground font-medium">Total Owed</span>
                        <CurrencyDisplay amount={Number(debt.total_amount)} className="text-base font-semibold block text-muted-foreground" />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-muted-foreground font-medium">
                        <span>Paid Off</span>
                        <span className="font-bold text-foreground tabular-nums">{Math.round(progress * 100)}%</span>
                      </div>
                      <Progress value={progress * 100} className="h-2 rounded-full [&>div]:bg-rose-500" />
                    </div>

                    {history.length > 0 && (
                      <div className="space-y-1.5 pt-1 border-t border-border">
                        <span className="text-xs text-muted-foreground font-medium">Payment History</span>
                        {history.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground text-xs">{formatDate(p.paid_at, "MMM d, yyyy")}</span>
                            <span className="flex items-center gap-1 tabular-nums">
                              <CurrencyDisplay amount={Number(p.amount)} className="font-semibold" />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-slate-500 hover:text-rose-600"
                                title="Undo payment"
                                onClick={() => handleUnpay(p.id)}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      onClick={() => openPayModal(debt)}
                      disabled={paidOff}
                      className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs h-9 shadow-xs cursor-pointer"
                    >
                      <HandCoins className="h-4 w-4 mr-1.5" /> Make Payment
                    </Button>
                  </FintechCardContent>
                </FintechCard>
              );
            })}
          </div>
        )}
      </div>
```

- [ ] **Step 6: Add the New/Edit Debt dialog** — after the Record Contribution dialog (after line ~519):

```tsx
      {/* New / Edit Debt Dialog */}
      <Dialog open={debtModalOpen} onOpenChange={setDebtModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedDebt ? "Edit Debt" : "New Debt"}</DialogTitle>
            <DialogDescription>
              Track what you owe. Payments will register as expenses toward payoff.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDebtSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="debt-name">Debt Name <span className="text-rose-500">*</span></Label>
              <Input
                id="debt-name"
                placeholder="e.g. Motorcycle Loan, Credit Card"
                value={debtName}
                onChange={(e) => setDebtName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-total">Total Owed (₱) <span className="text-rose-500">*</span></Label>
              <Input
                id="debt-total"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={debtTotal}
                onChange={(e) => setDebtTotal(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-due">Due Date <span className="text-rose-500">*</span></Label>
              <Input
                id="debt-due"
                type="date"
                value={debtDueDate}
                onChange={(e) => setDebtDueDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-category">Expense Category (Optional)</Label>
              <Select value={debtCategory} onValueChange={(val) => setDebtCategory(val || "")}>
                <SelectTrigger id="debt-category">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="debt-notes">Notes (Optional)</Label>
              <Textarea
                id="debt-notes"
                placeholder="Lender, terms, or payoff plan..."
                value={debtNotes}
                onChange={(e) => setDebtNotes(e.target.value)}
                rows={2}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDebtModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="bg-rose-600 hover:bg-rose-700 text-white">
                {selectedDebt ? "Save Changes" : "Create Debt"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 7: Add the Make Payment dialog** — after the New/Edit Debt dialog:

```tsx
      {/* Make Payment Dialog */}
      <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Pay {selectedDebt?.name || ""}</DialogTitle>
            <DialogDescription>
              Logs a payment toward this debt. This will register as an expense in the selected category.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePaySubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Payment Amount (₱) <span className="text-rose-500">*</span></Label>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Date <span className="text-rose-500">*</span></Label>
              <Input
                id="pay-date"
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-category">Expense Category <span className="text-rose-500">*</span></Label>
              <Select value={payCategory} onValueChange={(val) => setPayCategory(val || "")} required>
                <SelectTrigger id="pay-category">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-notes">Notes (Optional)</Label>
              <Input
                id="pay-notes"
                placeholder="e.g. Monthly amortization"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setPayModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="bg-rose-600 hover:bg-rose-700 text-white">
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 8: Add the delete confirmation** — after the existing Delete Confirmation `ConfirmDialog` (after line ~529):

```tsx
      {/* Delete Debt Confirmation */}
      <ConfirmDialog
        open={!!debtDeleteId}
        onOpenChange={(open) => !open && setDebtDeleteId(null)}
        onConfirm={handleDebtDelete}
        title="Delete Debt"
        description="This will permanently delete this debt and its payment history. Payments already logged will remain as expenses in your transactions. This action cannot be undone."
        loading={deletingDebt}
      />
```

- [ ] **Step 9: Local gates**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm test`
Expected: all pass.
Run: `npm run lint`
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add src/app/\(dashboard\)/savings/page.tsx src/app/\(dashboard\)/savings/savings-page-client.tsx
git commit -m "feat(debt): Payoff Debts section on savings page"
```

---

### Task 7: Full gates

**Files:** none (verification).

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Tests**

Run: `npm test`
Expected: all suites pass (existing + `debt.test.ts` + `debt.service.test.ts`).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: completes; no type errors; no data-fetching regressions.

- [ ] **Step 5: If a gate failed**

Fix forward (small corrective commit `fix(debt): <what>`), re-run the failing gate, then re-run all four. Do not proceed to Task 8 until all four are green.

---

### Task 8: Live verification (CDP on prod) + verification commit

**Files:** none (verification only).
**Prereqs:** Master pushed and deployed — `vercel deploy --target production --yes` first; wait for the production alias healthy. QA fixtures baseline: income rows Salary ₱1,234.56 (2026-09-08) + Incentives ₱2,500 (2026-09-09); Bills seeded templates present; no debts yet. CDP on `ws://127.0.0.1:9228` (QA profile), helpers in `$env:TEMP\opencode`.

- [ ] **Step 1: Deploy**

Run: `vercel deploy --target production --yes`
Expected: deployment URL printed and healthy; then click-through confirms the Savings page renders.

- [ ] **Step 2: Create a debt**

On `/savings`: click **New Debt**, fill Motorcycle Loan / ₱20,000 / due 2026-10-30, category Utilities, notes "Test payoff". Verify the card renders with Remaining ₱20,000, 0% paid, no badges, **Make Payment** enabled. Screenshot `verification/debt-01-created.png`.

- [ ] **Step 3: Pay ₱5,000 → expense linkage + snapshot**

Click **Make Payment**: amount ₱5,000, date today (2026-09-18), category Utilities, notes "Amortization 1". Verify: toast "Recorded ₱5,000 payment…", card shows Remaining ₱15,000 and 25% paid, and the Payment History row appears with an undo button. Open `/transactions` → an expense row `Motorcycle Loan ₱5,000` dated 2026-09-18 exists. Screenshots `debt-02-paid.png`, `debt-03-expense.png`.

Then verify the **snapshot** regenerated via Management API (replace `<!--user-->` with the QA user id from `select id from auth.users limit 1` scoped to the QA email — resolve at runtime):

```sql
SELECT month, year, total_income, total_expenses FROM monthly_snapshots
WHERE user_id = '<!--user-->' AND year = 2026 AND month = 9;
```

Expected: `total_expenses` includes the new ₱5,000 (the Sept snapshot was regenerated by `payDebt`).

- [ ] **Step 4: Overpay rejection**

Pay ₱20,000 on the same debt → the toast shows "Payment exceeds the remaining balance." and no history row appears. Screenshot `debt-04-overpay.png`.

- [ ] **Step 5: Unpay symmetry**

Undo the ₱5,000 payment → card returns to Remaining ₱20,000, 0% paid; the expense disappears from `/transactions`. Screenshot `debt-05-unpay.png`.

- [ ] **Step 6: Full payoff + Paid Off**

Pay ₱20,000 (full remaining) → card shows **Paid Off** badge, Remaining ₱0, Make Payment disabled, 100% paid. Screenshot `debt-06-paid-off.png`.

- [ ] **Step 7: Edit-guard**

Edit the debt total to ₱10,000 (below the ₱20,000 already paid and the current total) → toast "Total amount can't be less than what's already paid off." (Only reachable with a paid-then-total-drop scenario — recreate by adding a small payment first if needed.) Screenshot `debt-07-edit-guard.png`.

- [ ] **Step 8: Delete keeps expenses (deleteBill parity)**

Delete the debt → gone from the section; but the ₱20,000 expense from Step 6 **remains** on `/transactions`. Screenshots `debt-08-deleted.png`, `debt-08-expense-retained.png`.

- [ ] **Step 9: Bills snapshot regression check (bundled fix)**

Pay any seeded bill occurrence (e.g., Internet at ₱1,500, day 25) with **no other Sept activity**, then re-run the Task 8 Step 3 snapshot query — Expected: `total_expenses` for September now includes the ₱1,500 (previously this month would never have been regenerated). Unpay the bill; re-check the snapshot returns to the prior total. This proves `payBill`/`unpayBill` now match `payDebt`/`unpayDebt`. Screenshots `debt-09-bill-paid.png`, `debt-09-bill-unpaid.png`.

- [ ] **Step 10: Restore QA fixtures**

Remove the test debt(s), the test expenses, and undo the test bill payment, so the account returns to the QA baseline. Empty state "No Debts Tracked" re-appears. Screenshot `debt-10-clean.png`.

- [ ] **Step 11: Verification commit + push**

```bash
git add -A
git commit -m "feat(verify): debt tracking live-verified"
git push origin master
```

Note in the commit body: any deferred/bounded checks (none expected this feature; deadline notifications explicitly deferred per spec §9).

---

## Self-Review Notes

- **Spec coverage:** §2 data model (debts, debt_payments, RPCs, RLS) → Task 3; §3 pure engine → Task 1; §2.3/§4 service + cache → Task 2; §5 actions + validators + snapshot regen → Task 4; §5 Bundled K2 fix (payBill/unpayBill snapshot) → Task 5; §6 UI (page wiring, section, dialogs, delete copy) → Task 6; §8 testing/gates → Tasks 1–7; §8 migration apply + live verification → Tasks 3 and 8. Spec §9 "explicitly untouched" honored (Global Constraints 9–10). Spec §4 updateDebt guard → Task 2; overpay guard → Task 3 (RPC) + Task 2 (service). Edge rules (derived balance, paid-off, delete-parity) → Tasks 1, 3, 8.
- **Placeholder scan:** No TODO/TBD. Every code step is concrete. Single runtime substitution lives in Task 8 Step 3 (`<!--user-->` — a data lookup, deliberately not a code placeholder).
- **Type consistency:** `Debt`/`DebtPayment`/`DebtView` defined Task 1 (`src/lib/types/index.ts`), `DebtInput` defined Task 2 (`src/lib/services/debt.service.ts`), used Tasks 2–6. Helpers `debtPaidOffAmount`/`debtRemaining`/`debtProgress`/`isDebtPaidOff`/`isDebtOverdue` defined Task 1, called with identical signatures Task 6. Actions `addDebt`/`editDebt`/`removeDebt`/`payDebt`/`unpayDebt`, schemas `debtInputSchema`/`payDebtSchema`/`unpayDebtSchema`, and inferred types all named once in Task 2/4 and used verbatim in Task 6. `cachedGetDebts` + `"debts"` tag suffix cross-task consistent. `isDebtOverdue(debt, paid, today)` 3-arg call matches Task 1 signature. `unpayDebt({ paymentId })` call matches the `UnpayDebtSchemaType` input shape Task 4.