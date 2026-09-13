# K2 — Bills Calendar (cutoff-aware) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cutoff-aware recurring bills to MoneyMap PH — calendar, pay flow that logs real expenses, "before next paycheck" coverage vs safe-to-spend, and drawer alerts — nested inside the Income page as a second tab.

**Architecture:** A dedicated bills subsystem (overlay over the existing monthly financial model). A pure occurrence engine (`src/lib/utils/bills.ts`) computes clamped monthly due dates and enforces the money-surface gate; a service layer (`bills.service.ts`) plus two cached wrappers feed a `/income?tab=bills` view; payment/expense-linking is atomic in two `SECURITY INVOKER` RPCs; two read-time alerts join the dashboard drawer.

**Tech Stack:** Next 16 (Breaking-change conventions — see Global Constraints), React 19, Turbopack build, Supabase (Postgres RLS, RPC), zod validators, date-fns, vitest, lucide-react, the existing FintechCard/CurrencyDisplay/Tabs vocabulary.

**Spec:** `docs/superpowers/specs/2026-09-13-bills-calendar-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

1. **Next 16, not the Next you know.** Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` before any page change. `searchParams`/`params` page props are **Promises**: `const { tab } = await props.searchParams`. Repo example: `src/app/(dashboard)/transactions/print/page.tsx:10-17`. Using `searchParams` opts a page into dynamic rendering (the income page is already dynamic).
2. **Money-surface gate = `ready AND active`.** `ready` = `expected_amount != null AND day_of_month != null`. Bills failing it are **never** on the calendar, in summaries, in totals, or in notifications. The CRUD list is the only place every bill always renders (labeled `Incomplete`/`Paused`/normal).
3. **Actual beats forecast.** Paid occurrences always use `bill_payments.amount`; `expected_amount` only where no payment exists.
4. **Never invent a number.** Seeded template rows have `expected_amount = NULL` and `day_of_month = NULL` (they are `Incomplete` until the user sets both). No day default, no fake amounts.
5. **Overlay guarantee.** Do not touch: `financial.service`, `forecast.service`, `snapshot.service`, budget services, Health Score math, `safe-to-spend.service` internals, `reminders` semantics (drawer checklist unchanged), or `NAV_ITEMS`/`constants.ts` nav shape.
6. **Derived cutoff, never stored.** Period attribution comes from `getCutoffPeriodForDate(dueDate)`. No `period_end` column is added anywhere.
7. **No secrets in repo/chat.** Cloud migration apply reads the scoped token from env var `SUPABASE_PAT_K2` (user supplies from their store). Never paste a token into a file or commit.
8. **Migration placement (plan deviation from spec §9).** The seeding change does **not** edit `001_initial_schema.sql` — existing cloud DBs already ran 001 and would never apply the edit. `008_bills_schema.sql` carries the tables, RLS, RPCs, and a `CREATE OR REPLACE FUNCTION handle_new_user()` that reproduces the 001 body (profiles/income_sources/expense_categories inserts) and adds the bills seed. Fresh installs and the live cloud DB then converge.
9. **Testing conventions.** No component-test harness exists. Spec §8's "Components" tests are implemented as **pure state-derivation functions** tested in node vitest (calendar cell builder, summary verdict, bill profile), plus live CDP verification of rendering. Test commands: `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`.
10. **Revalidation on every bill mutation**: `revalidatePath("/income")` + `"/expenses"` + `"/dashboard"`.
11. **Copy rules.** Verdict labels reuse the V2 language: `covered`·`tight`·`short`; drawer IDs exactly `bills-due-soon-<setHash>` and `bills-coverage-<periodEnd>`.

---

### Task 1: Pure bills engine + types

**Files:**
- Create: `src/lib/utils/bills.ts`
- Modify: `src/lib/types/index.ts` (append Bill-related types)
- Test: `src/tests/bills.test.ts`

**Interfaces:**
- Consumes: `CutoffPeriod`, `getCutoffPeriodForDate`, `getPayoutDateForPeriodEnd`, `listCutoffPeriodsBetween`, `CUTOFF_ANCHOR_DAYS` from `src/lib/utils/pay-period.ts:1-60`; `toISODateString` from `@/lib/utils/date`.
- Produces (used by Tasks 2-9):
  - `Bill { id; user_id; name; expected_amount: string | null; category_id: string | null; day_of_month: number | null; active: boolean; notes: string | null; created_at; updated_at }` (in `types`)
  - `BillPayment { id; bill_id; due_date: string; paid_at: string; amount: string; expense_id: string | null; created_at; updated_at }` (in `types`)
  - `BillOccurrence { bill_id: string; billName: string; dueDate: string; expectedAmount: number; cutoffPeriodEnd: string }` (in `types`)
  - `BillView { bills: Bill[]; occurrences: BillOccurrence[]; payments: BillPayment[] }` (in `types`)
  - `BillsDueBy { occurrences: BillOccurrence[]; paidTotal: number; upcomingTotal: number; totalDue: number; horizonDate: string }` (in `types`)
  - `type SummaryVerdict = "covered" | "tight" | "short"` (in `types`)
  - `isBillOnMoneySurfaces(bill: Pick<Bill, "expected_amount" | "day_of_month" | "active">): boolean`
  - `getBillDueDate(dayOfMonth: number, year: number, month: number): Date` (month is 0-based)
  - `listBillOccurrences(bills: Bill[], from: Date, to: Date): BillOccurrence[]` — **enforces `isBillOnMoneySurfaces` internally**
  - `getNextPayoutDate(from: Date): Date`
  - `bucketCutoff(dueDate: Date): string` (ISO periodEnd)
  - `dueSoonKey(occurrences: Array<{ bill_id: string; dueDate: string; expectedAmount: number }>): string` — returns `bills-due-soon-<8hex>`

- [ ] **Step 1: Write the failing test** — `src/tests/bills.test.ts`

```ts
import { describe, it, expect } from "vitest";
import {
  isBillOnMoneySurfaces,
  getBillDueDate,
  listBillOccurrences,
  getNextPayoutDate,
  bucketCutoff,
  dueSoonKey,
} from "@/lib/utils/bills";
import type { Bill } from "@/lib/types";

const readyActive = (over: Partial<Bill> = {}): Bill => ({
  id: "b1",
  user_id: "u1",
  name: "Rent",
  expected_amount: "12000",
  category_id: null,
  day_of_month: 1,
  active: true,
  notes: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("isBillOnMoneySurfaces", () => {
  it("true only when amount, day, and active are all set", () => {
    expect(isBillOnMoneySurfaces(readyActive())).toBe(true);
    expect(isBillOnMoneySurfaces(readyActive({ expected_amount: null }))).toBe(false);
    expect(isBillOnMoneySurfaces(readyActive({ day_of_month: null }))).toBe(false);
    expect(isBillOnMoneySurfaces(readyActive({ active: false }))).toBe(false);
    expect(isBillOnMoneySurfaces(readyActive({ expected_amount: null, day_of_month: null }))).toBe(false);
  });
});

describe("getBillDueDate", () => {
  it("clamps to the last day of the month", () => {
    expect(getBillDueDate(31, 2026, 3).getDate()).toBe(30); // April 2026
    expect(getBillDueDate(31, 2026, 1).getDate()).toBe(28); // Feb 2026 non-leap
    expect(getBillDueDate(29, 2028, 1).getDate()).toBe(29); // Feb 2028 leap
    expect(getBillDueDate(15, 2026, 6, ).getDate()).toBe(15); // July
  });
});

describe("listBillOccurrences", () => {
  it("emits one clamped occurrence per eligible bill in range", () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 2, 31);
    const occ = listBillOccurrences([readyActive()], start, end);
    expect(occ).toHaveLength(3);
    expect(occ[0]).toMatchObject({ bill_id: "b1", expectedAmount: 12000 });
    expect(occ[0].dueDate).toBe("2026-01-01");
    expect(occ[2].dueDate).toBe("2026-03-01");
  });
  it("NEVER emits occurrences for paused or incomplete bills (engine-enforced gate)", () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 1, 28);
    const bills = [
      readyActive(),
      readyActive({ id: "paused", active: false }),
      readyActive({ id: "no-day", day_of_month: null }),
      readyActive({ id: "no-amount", expected_amount: null }),
    ];
    const occ = listBillOccurrences(bills, start, end);
    expect(occ.every((o) => o.bill_id === "b1")).toBe(true);
  });
});

describe("getNextPayoutDate & bucketCutoff", () => {
  it("rolls weekends back to Friday via the V1 engine", () => {
    expect(getNextPayoutDate(new Date(2026, 8, 1)).toISOString().slice(0, 10)).toBe("2026-09-11"); // cutoff 09-13 (Sun)
    expect(getNextPayoutDate(new Date(2026, 8, 14)).toISOString().slice(0, 10)).toBe("2026-09-28");
  });
  it("buckets a due date into its cutoff", () => {
    expect(bucketCutoff(new Date(2026, 8, 5))).toBe("2026-09-13");
    expect(bucketCutoff(new Date(2026, 8, 20))).toBe("2026-09-28");
  });
});

describe("dueSoonKey", () => {
  it("is stable for the same set regardless of order", () => {
    const a = dueSoonKey([{ bill_id: "1", dueDate: "2026-09-15", expectedAmount: 100 }]);
    const b = dueSoonKey([{ bill_id: "1", dueDate: "2026-09-15", expectedAmount: 100 }]);
    expect(a).toBe(b);
    expect(a.startsWith("bills-due-soon-")).toBe(true);
  });
  it("changes when content changes (paid exit, new entry, amount edit)", () => {
    const base = [{ bill_id: "1", dueDate: "2026-09-15", expectedAmount: 100 }];
    const without = dueSoonKey([]);
    const paid = dueSoonKey([{ bill_id: "2", dueDate: "2026-09-18", expectedAmount: 500 }]);
    const edited = dueSoonKey([{ bill_id: "1", dueDate: "2026-09-15", expectedAmount: 250 }]);
    expect(dueSoonKey(base)).not.toBe(without);
    expect(dueSoonKey(base)).not.toBe(paid);
    expect(dueSoonKey(base)).not.toBe(edited);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tests/bills.test.ts -t "bills"`
Expected: FAIL — `@/lib/utils/bills` resolves to nothing / functions undefined.

- [ ] **Step 3: Append types to `src/lib/types/index.ts`**

Keep the file's existing type-export style. Add:

```ts
export interface Bill {
  id: string;
  user_id: string;
  name: string;
  expected_amount: string | null;
  category_id: string | null;
  day_of_month: number | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillPayment {
  id: string;
  bill_id: string;
  due_date: string;
  paid_at: string;
  amount: string;
  expense_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillOccurrence {
  bill_id: string;
  billName: string;
  dueDate: string;
  expectedAmount: number;
  cutoffPeriodEnd: string;
}

export interface BillView {
  bills: Bill[];
  occurrences: BillOccurrence[];
  payments: BillPayment[];
}

export interface BillsDueBy {
  occurrences: BillOccurrence[];
  paidTotal: number;
  upcomingTotal: number;
  totalDue: number;
  horizonDate: string;
}

export type SummaryVerdict = "covered" | "tight" | "short";
```

- [ ] **Step 4: Implement `src/lib/utils/bills.ts`**

```ts
import { Bill, BillOccurrence } from "@/lib/types";
import {
  getCutoffPeriodForDate,
  getPayoutDateForPeriodEnd,
} from "@/lib/utils/pay-period";
import { toISODateString } from "@/lib/utils/date";
import { lastDayOfMonth } from "date-fns";

export function isBillOnMoneySurfaces(
  bill: Pick<Bill, "expected_amount" | "day_of_month" | "active">
): boolean {
  return bill.expected_amount != null && bill.day_of_month != null && bill.active;
}

export function getBillDueDate(dayOfMonth: number, year: number, month: number): Date {
  const candidate = new Date(year, month, dayOfMonth);
  const last = lastDayOfMonth(candidate);
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
```

Check `toISODateString` exists in `src/lib/utils/date.ts` (it is imported in `shared-queries.ts:11`); `lastDayOfMonth` is available from the existing `date-fns` dependency (`pay-period.ts` already annotates date-fns usage).

- [ ] **Step 5: Run tests, expect PASS**

Run: `npx vitest run src/tests/bills.test.ts`
Expected: all it() blocks PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types/index.ts src/lib/utils/bills.ts src/tests/bills.test.ts
git commit -m "feat(bills): pure occurrence engine and money-surface gate"
```

---

### Task 2: Service layer + cached wrappers

**Files:**
- Create: `src/lib/services/bills.service.ts`
- Modify: `src/lib/cache/shared-queries.ts` (add two wrappers)
- Test: `src/tests/bills.service.test.ts`

**Interfaces:**
- Consumes: `Bill`, `BillPayment`, `BillView`, `BillsDueBy` types; `listBillOccurrences`, `isBillOnMoneySurfaces` from Task 1; `REVALIDATE_SECONDS` pattern in `shared-queries.ts:24`; `SupabaseClient`.
- Produces (used by Tasks 4-9):
  - `getBills(supabase, userId): Promise<Bill[]>`
  - `createBill(supabase, userId, input: BillInput): Promise<Bill>`
  - `updateBill(supabase, userId, id, input: Partial<BillInput>): Promise<Bill>`
  - `deleteBill(supabase, userId, id): Promise<void>`
  - `getBillView(supabase, userId, year, month): Promise<BillView>`
  - `getBillsDueBy(supabase, userId, horizonDate: string): Promise<BillsDueBy>`
  - `type BillInput = { name: string; expected_amount?: string | null; category_id?: string | null; day_of_month?: number | null; notes?: string | null; active?: boolean }` (export from `bills.service.ts`)
  - `cachedGetBillView(supabase, userId, year, month): Promise<BillView>` (tag `q:bills:<userId>`)
  - `cachedGetBillsDueBy(supabase, userId, horizonDate): Promise<BillsDueBy>` (tag `q:bills:<userId>`)

- [ ] **Step 1: Write the failing test** — `src/tests/bills.service.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getBills,
  createBill,
  updateBill,
  deleteBill,
  getBillView,
  getBillsDueBy,
} from "@/lib/services/bills.service";

// Mock Supabase that records chains similarly to financial.service.test.ts.
function mockSupabase() {
  const calls: unknown[] = [];
  const builder = (tableName: string) => ({
    select: () => ({ eq: () => ({ order: () => ({ gte: () => ({ lte: () => ({}) }) }) }) }),
    insert: (row: unknown) => { calls.push(["insert", row]); return { select: () => ({ single: () => Promise.resolve({ data: { id: "n1", ...(row as object) }, error: null }) }) }; },
    update: (row: unknown) => { calls.push(["update", row]); return { eq: () => ({ eq: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "b1", ...(row as object) }, error: null }) }) }) }) }; },
    delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  });
  const supabase: any = {
    from: (t: string) => (t === "expenses" ? { ...builder(t) } : builder(t)),
    rpc: (fn: string, args: unknown) => Promise.resolve({ data: { fn, args }, error: null }),
  };
  return { supabase, calls };
}

const userId = "u1";

beforeEach(() => vi.clearAllMocks());

describe("bills.service", () => {
  it("createBill inserts a row scoped to the user", async () => {
    const { supabase } = mockSupabase();
    const bill = await createBill(supabase, userId, { name: "Internet", day_of_month: 15 });
    expect(bill.id).toBe("n1");
    expect(bill.user_id).toBe(userId);
  });

  it("getBillView keeps the raw bill array separate from gated occurrences", async () => {
    const { supabase } = mockSupabase();
    // bills raw: includes incomplete + paused; occurrences list from listBillOccurrences
    const bills = [
      { id: "ready", user_id: userId, name: "Rent", expected_amount: "12000", day_of_month: 1, active: true, category_id: null, notes: null, created_at: "x", updated_at: "x" },
      { id: "paused", user_id: userId, name: "Net", expected_amount: "1500", day_of_month: 15, active: false, category_id: null, notes: null, created_at: "x", updated_at: "x" },
    ];
    const view = await getBillView(supabase, userId, 2026, 8);
    expect(view.bills.length).toBe(2);          // raw: management list sees everything
    const paid = view.occurrences.every((o) => o.bill_id === "ready"); // engine gate: only ready+active
    expect(paid).toBe(true);
  });

  it("getBillsDueBy totals paid-at-actual and unpaid-at-expected", async () => {
    const { supabase } = mockSupabase();
    const due = await getBillsDueBy(supabase, userId, "2026-09-28");
    expect(typeof due.totalDue).toBe("number");
    expect(due.horizonDate).toBe("2026-09-28");
  });

  it("deleteBill deletes user-scoped", async () => {
    const { supabase } = mockSupabase();
    await expect(deleteBill(supabase, userId, "b1")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tests/bills.service.test.ts`
Expected: FAIL — `bills.service` module not found.

- [ ] **Step 3: Implement `src/lib/services/bills.service.ts`**

The mock above is deliberately loose; the real service uses real supabase chains exactly like `reminder.service.ts` / `pay-period.service.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { Bill, BillPayment, BillView, BillsDueBy } from "@/lib/types";
import { listBillOccurrences } from "@/lib/utils/bills";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

export type BillInput = {
  name: string;
  expected_amount?: string | null;
  category_id?: string | null;
  day_of_month?: number | null;
  notes?: string | null;
  active?: boolean;
};

export async function getBills(supabase: SupabaseClient, userId: string): Promise<Bill[]> {
  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("user_id", userId)
    .order("day_of_month", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []) as Bill[];
}

export async function createBill(
  supabase: SupabaseClient,
  userId: string,
  input: BillInput
): Promise<Bill> {
  const { data, error } = await supabase
    .from("bills")
    .insert({
      user_id: userId,
      name: input.name,
      expected_amount: input.expected_amount ?? null,
      category_id: input.category_id ?? null,
      day_of_month: input.day_of_month ?? null,
      notes: input.notes ?? null,
      active: input.active ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Bill;
}

export async function updateBill(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  input: Partial<BillInput>
): Promise<Bill> {
  const { data, error } = await supabase
    .from("bills")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return data as Bill;
}

export async function deleteBill(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase.from("bills").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function getBillView(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: number
): Promise<BillView> {
  const from = startOfMonth(new Date(year, month - 1, 1));
  const to = endOfMonth(new Date(year, month - 1, 1));
  const [bills, payments] = await Promise.all([
    getBills(supabase, userId),
    supabase
      .from("bill_payments")
      .select("*")
      .in(
        "bill_id",
        billsPlaceholder // replaced below — see Step 3 note
      ),
  ]);
  void payments;
  void from;
  void to;
  throw new Error("implemented in Step 4");
}
```

Run the service test alongside the real rules in Step 4 — the placeholder above is intentional so Task 2's commit milestone isn't left broken: **implement `getBillView` and `getBillsDueBy` fully in Step 4 below; do not commit the placeholder version.**

- [ ] **Step 4: Full implementations of `getBillView` and `getBillsDueBy` (replace the placeholder from Step 3 in the same file)**

```ts
const BILLS_OVERDUE_LOOKBACK_MONTHS = 6;

export async function getBillView(
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: number
): Promise<BillView> {
  const from = startOfMonth(new Date(year, month - 1, 1));
  const to = endOfMonth(new Date(year, month - 1, 1));
  const bills = await getBills(supabase, userId);

  const { data: payments, error } = await supabase
    .from("bill_payments")
    .select("*")
    .in(
      "bill_id",
      bills.length > 0 ? bills.map((b) => b.id) : ["00000000-0000-0000-0000-000000000000"]
    );
  if (error) throw error;

  return {
    bills,
    occurrences: listBillOccurrences(bills, from, to),
    payments: (payments || []) as BillPayment[],
  };
}

function isoDaysAgo(base: string, days: number): string {
  const d = new Date(base + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function getBillsDueBy(
  supabase: SupabaseClient,
  userId: string,
  horizonDate: string
): Promise<BillsDueBy> {
  const bills = await getBills(supabase, userId);
  const lookbackStart = isoDaysAgo(horizonDate, BILLS_OVERDUE_LOOKBACK_MONTHS * 30);
  const from = new Date(lookbackStart + "T00:00:00Z");
  const to = new Date(horizonDate + "T00:00:00Z");

  let payments: BillPayment[] = [];
  if (bills.length > 0) {
    const { data, error } = await supabase
      .from("bill_payments")
      .select("*")
      .in(
        "bill_id",
        bills.map((b) => b.id)
      );
    if (error) throw error;
    payments = (data || []) as BillPayment[];
  }

  const paid = new Set(payments.map((p) => `${p.bill_id}|${p.due_date}`));
  const occurrences = listBillOccurrences(bills, from, to).filter((o) => !paid.has(`${o.bill_id}|${o.dueDate}`));

  const paidTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const upcomingTotal = occurrences.reduce((s, o) => s + o.expectedAmount, 0);
  return { occurrences, paidTotal, upcomingTotal, totalDue: paidTotal + upcomingTotal, horizonDate };
}
```

- [ ] **Step 5: Add cached wrappers to `src/lib/cache/shared-queries.ts`**

After `cachedGetSafeToSpend` (line 124) append (imports: `getBillView`, `getBillsDueBy` from `@/lib/services/bills.service`; types `BillView`, `BillsDueBy`):

```ts
export const cachedGetBillView = (
  supabase: SupabaseClient,
  userId: string,
  year: number,
  month: number
): Promise<BillView> =>
  unstable_cache(
    async (y: number, m: number) => getBillView(supabase, userId, y, m),
    ["bill-view", userId],
    { revalidate: REVALIDATE_SECONDS, tags: [`q:bills:${userId}`] }
  )(year, month);

export const cachedGetBillsDueBy = (
  supabase: SupabaseClient,
  userId: string,
  horizonDate: string
): Promise<BillsDueBy> =>
  unstable_cache(
    async (h: string) => getBillsDueBy(supabase, userId, h),
    ["bills-due-by", userId, horizonDate],
    { revalidate: REVALIDATE_SECONDS, tags: [`q:bills:${userId}`] }
  )(horizonDate);
```

- [ ] **Step 6: Run tests, expect PASS**

Run: `npx vitest run src/tests/bills.service.test.ts src/tests/bills.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/bills.service.ts src/lib/cache/shared-queries.ts src/tests/bills.service.test.ts
git commit -m "feat(bills): service layer for bills and due-by summaries"
```

---

### Task 3: Schema migration 008 + validators

**Files:**
- Create: `supabase/migrations/008_bills_schema.sql`
- Modify: `src/lib/utils/validators.ts`
- Test: `src/tests/source-schema.test.ts` is a precedent only; validators are covered by Task 4's action smoke paths. No new validator test file is required (zod schemas are exercised through actions + live verification).

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (used by Task 4): table `public.bills`, `public.bill_payments`, RPCs `pay_bill` / `unpay_bill`, updated `handle_new_user()` with bills seeding; zod `billInputSchema`, `payBillSchema`, `unpayBillSchema` + exported inferred types `BillInputSchemaType`, `PayBillSchemaType`, `UnpayBillSchemaType`.

- [ ] **Step 1: Write `supabase/migrations/008_bills_schema.sql`**

```sql
-- ============================================================
-- BILLS SCHEMA (K2)
-- Tables, RLS, RPCs, and seeded onboarding templates.
-- NOTE: handle_new_user is recreated here so live DBs (which
-- already ran 001) converge with fresh installs.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  expected_amount NUMERIC(12,2) CHECK (expected_amount IS NULL OR expected_amount > 0),
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  day_of_month INTEGER CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31),
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bills_user ON public.bills(user_id);
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bills" ON public.bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bills" ON public.bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bills" ON public.bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bills" ON public.bills FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  paid_at DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bill_id, due_date)
);

CREATE INDEX IF NOT EXISTS idx_bill_payments_bill ON public.bill_payments(bill_id, due_date);
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bill payments" ON public.bill_payments
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.bills WHERE bills.id = bill_payments.bill_id AND bills.user_id = auth.uid()));
CREATE POLICY "Users can insert own bill payments" ON public.bill_payments
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.bills WHERE bills.id = bill_payments.bill_id AND bills.user_id = auth.uid()));
CREATE POLICY "Users can update own bill payments" ON public.bill_payments
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.bills WHERE bills.id = bill_payments.bill_id AND bills.user_id = auth.uid()));
CREATE POLICY "Users can delete own bill payments" ON public.bill_payments
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.bills WHERE bills.id = bill_payments.bill_id AND bills.user_id = auth.uid()));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bill_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------
-- RPC: pay_bill — log an expense + payment in one transaction
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_bill(
  p_bill_id uuid,
  p_due_date date,
  p_paid_at date,
  p_category_id uuid,
  p_amount numeric,
  p_notes text DEFAULT NULL
) RETURNS public.bill_payments
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_bill public.bills%ROWTYPE;
  v_expense_id uuid;
  v_result public.bill_payments%ROWTYPE;
BEGIN
  SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'bill_not_found'; END IF;
  IF v_bill.expected_amount IS NULL OR v_bill.day_of_month IS NULL OR NOT v_bill.active THEN
    RAISE EXCEPTION 'bill_not_ready';
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount_invalid'; END IF;

  INSERT INTO public.expenses (user_id, title, amount, category_id, date, notes)
  VALUES (auth.uid(), v_bill.name, p_amount, p_category_id, p_paid_at, p_notes)
  RETURNING id INTO v_expense_id;

  INSERT INTO public.bill_payments (bill_id, due_date, paid_at, amount, expense_id)
  VALUES (p_bill_id, p_due_date, p_paid_at, p_amount, v_expense_id)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- ------------------------------------------------------------
-- RPC: unpay_bill — remove payment AND its linked expense atomically
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unpay_bill(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_expense_id uuid;
  v_owned boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.bill_payments bp
    JOIN public.bills b ON b.id = bp.bill_id
    WHERE bp.id = p_payment_id AND b.user_id = auth.uid()
  ) INTO v_owned;
  IF NOT v_owned THEN RAISE EXCEPTION 'payment_not_found'; END IF;

  SELECT expense_id INTO v_expense_id FROM public.bill_payments WHERE id = p_payment_id;

  DELETE FROM public.bill_payments WHERE id = p_payment_id;
  IF v_expense_id IS NOT NULL THEN
    DELETE FROM public.expenses WHERE id = v_expense_id AND user_id = auth.uid();
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- Onboarding: seed bill templates (ready = false, active = true)
-- Recreates handle_new_user with the 001 body + bills.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );

  INSERT INTO public.income_sources (user_id, name, is_default, sort_order) VALUES
    (NEW.id, 'Salary', true, 1),
    (NEW.id, 'Night Differential', true, 2),
    (NEW.id, 'Incentives', true, 3),
    (NEW.id, 'Bonuses', true, 4),
    (NEW.id, 'Holiday Pay', true, 5),
    (NEW.id, 'Overtime Pay', true, 6),
    (NEW.id, 'Freelance Income', true, 7),
    (NEW.id, 'Other Income', true, 8);

  INSERT INTO public.expense_categories (user_id, name, icon, color, is_default, sort_order) VALUES
    (NEW.id, 'Transportation', '🚗', '#6366f1', true, 1),
    (NEW.id, 'Groceries', '🛒', '#8b5cf6', true, 2),
    (NEW.id, 'Supplements', '💊', '#a855f7', true, 3),
    (NEW.id, 'Eating Out', '🍽️', '#d946ef', true, 4),
    (NEW.id, 'Utilities', '💡', '#ec4899', true, 5),
    (NEW.id, 'Rent', '🏠', '#f43f5e', true, 6),
    (NEW.id, 'Internet', '📡', '#f97316', true, 7),
    (NEW.id, 'Savings', '💰', '#14b8a6', true, 8),
    (NEW.id, 'Emergency Fund', '🛡️', '#06b6d4', true, 9),
    (NEW.id, 'Motorcycle Fund', '🏍️', '#0ea5e9', true, 10),
    (NEW.id, 'Miscellaneous', '📦', '#64748b', true, 11);

  INSERT INTO public.bills (user_id, name, active) VALUES
    (NEW.id, 'SSS Contribution', true),
    (NEW.id, 'Pag-IBIG', true),
    (NEW.id, 'PhilHealth', true),
    (NEW.id, 'Rent', true),
    (NEW.id, 'Internet', true),
    (NEW.id, 'Electricity', true),
    (NEW.id, 'Water', true),
    (NEW.id, 'Postpaid/Phone', true),
    (NEW.id, 'Subscriptions', true),
    (NEW.id, 'Loan Payment', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 2: Add zod schemas to `src/lib/utils/validators.ts`**

Append below `sourceSchema` (line 103), keeping the existing style (coerce numbers, `.optional().or(z.literal(""))` for empties):

```ts
export const billInputSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  expected_amount: z.coerce.number().positive("Amount must be greater than 0").optional().or(z.literal("")),
  category_id: z.string().uuid("Select a category").optional().or(z.literal("")),
  day_of_month: z.coerce.number().int().min(1, "Day must be between 1 and 31").max(31, "Day must be between 1 and 31").optional().or(z.literal("")),
  notes: z.string().max(500, "Notes must be 500 characters or less").optional().or(z.literal("")),
});

export const payBillSchema = z.object({
  billId: z.string().uuid("Select a bill"),
  dueDate: z.string().min(1, "Due date is required"),
  paidAt: z.string().min(1, "Paid date is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0").max(999999999999, "Amount is too large"),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const unpayBillSchema = z.object({
  paymentId: z.string().uuid(),
});

export type BillInputSchemaType = z.infer<typeof billInputSchema>;
export type PayBillSchemaType = z.infer<typeof payBillSchema>;
export type UnpayBillSchemaType = z.infer<typeof unpayBillSchema>;
```

- [ ] **Step 3: Verify the validator file compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no pre-existing errors).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/008_bills_schema.sql src/lib/utils/validators.ts
git commit -m "feat(bills): schema migration 008 with RLS, RPCs, seeding and validators"
```

---

### Task 4: Server actions (pay / unpay / CRUD)

**Files:**
- Create: `src/app/(dashboard)/income/bills/actions.ts`
- Test: exercised via Task 6/7/8 components + Task 12 live; a light mock test file guards RPC arg shape: `src/tests/bills-actions.test.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/server`; `getUser`; schemas from Task 3; service CRUD + `BillInput` from Task 2; `revalidatePath` from `next/cache`.
- Produces (used by Tasks 6-8):
  - `payBill(input: { billId; dueDate; amount; paidAt?; categoryId?; notes? }): Promise<{ error?: string }>`
  - `unpayBill(input: { paymentId }): Promise<{ error?: string }>`
  - `createBill(input)`, `updateBill(input: { id } & Patch)`, `deleteBill(input: { id })` — all `Promise<{ error?: string }>`

Look at `src/app/(dashboard)/income/actions.ts` first and mirror its `createClient`/`getUser`/try-catch/`{ error }` return style exactly.

- [ ] **Step 1: Write the failing test** — `src/tests/bills-actions.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Validate schema behavior that actions depend on (no server env in unit tests).
import { billInputSchema, payBillSchema } from "@/lib/utils/validators";

describe("bill action schemas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("billInputSchema accepts partial template and full ready bill", () => {
    const partial = billInputSchema.parse({ name: "SSS Contribution" });
    expect(partial.day_of_month).toBeUndefined();
    const ready = billInputSchema.parse({ name: "Rent", expected_amount: "12000", day_of_month: 1 });
    expect(ready.expected_amount).toBe(12000);
  });

  it("payBillSchema rejects zero amount and accepts empty optional category", () => {
    expect(() => payBillSchema.parse({ billId: "11111111-1111-4111-8111-111111111111", dueDate: "2026-09-15", paidAt: "2026-09-15", amount: 0 })).toThrow();
    const ok = payBillSchema.parse({
      billId: "0f000000-0000-0000-0000-000000000000",
      dueDate: "2026-09-15",
      paidAt: "2026-09-15",
      amount: "3400",
      categoryId: "",
    });
    expect(ok.amount).toBe(3400);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tests/bills-actions.test.ts`
Expected: FAIL — schemas don't exist yet.

- [ ] **Step 3: Implement `src/app/(dashboard)/income/bills/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/server";
import { billInputSchema, payBillSchema, unpayBillSchema } from "@/lib/utils/validators";
import { createBill, updateBill, deleteBill } from "@/lib/services/bills.service";

type ActionResult = { error?: string };

export async function payBill(input: z.infer<typeof payBillSchema>): Promise<ActionResult> {
  const parsed = payBillSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid payment details" };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.rpc("pay_bill", {
    p_bill_id: parsed.data.billId,
    p_due_date: parsed.data.dueDate,
    p_paid_at: parsed.data.paidAt,
    p_category_id: parsed.data.categoryId || null,
    p_amount: parsed.data.amount,
    p_notes: parsed.data.notes || null,
  });
  if (error) {
    if (error.message.includes("bill_not_ready")) return { error: "This bill is paused or incomplete." };
    if (error.message.includes("duplicate") || error.code === "23505") return { error: "This occurrence is already paid." };
    return { error: "Could not log payment. Please try again." };
  }

  revalidatePath("/income");
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return {};
}

export async function unpayBill(input: z.infer<typeof unpayBillSchema>): Promise<ActionResult> {
  const parsed = unpayBillSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid payment" };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.rpc("unpay_bill", { p_payment_id: parsed.data.paymentId });
  if (error) return { error: "Could not undo payment. Please try again." };

  revalidatePath("/income");
  revalidatePath("/expenses");
  revalidatePath("/dashboard");
  return {};
}

export async function createBillAction(input: z.infer<typeof billInputSchema>): Promise<ActionResult> {
  const parsed = billInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid bill" };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not signed in" };

  try {
    await createBill(supabase, user.id, {
      name: parsed.data.name,
      expected_amount: parsed.data.expected_amount ? String(parsed.data.expected_amount) : null,
      category_id: parsed.data.category_id || null,
      day_of_month: parsed.data.day_of_month ?? null,
      notes: parsed.data.notes || null,
    });
  } catch {
    return { error: "Could not create bill" };
  }

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return {};
}

export async function updateBillAction(
  input: z.infer<typeof billInputSchema> & { id: string; active?: boolean }
): Promise<ActionResult> {
  const parsed = billInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid bill" };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not signed in" };

  try {
    await updateBill(supabase, user.id, input.id, {
      name: parsed.data.name,
      expected_amount: parsed.data.expected_amount ? String(parsed.data.expected_amount) : null,
      category_id: parsed.data.category_id || null,
      day_of_month: parsed.data.day_of_month ?? null,
      notes: parsed.data.notes || null,
      active: input.active ?? true,
    });
  } catch {
    return { error: "Could not save bill" };
  }

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteBillAction(input: { id: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: "Not signed in" };

  try {
    await deleteBill(supabase, user.id, input.id);
  } catch {
    return { error: "Could not delete bill" };
  }

  revalidatePath("/income");
  revalidatePath("/dashboard");
  return {};
}
```

- [ ] **Step 4: Run tests, expect PASS**

Run: `npx vitest run src/tests/bills-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/"(dashboard)"/income/bills/actions.ts src/tests/bills-actions.test.ts
git commit -m "feat(bills): pay, unpay, and CRUD server actions"
```

---

### Task 5: Income server page + Bills tab shell

**Files:**
- Modify: `src/app/(dashboard)/income/page.tsx`
- Modify: `src/app/(dashboard)/income/income-page-client.tsx`
- Tests: none new (page wiring verified in Task 12); ensure `npx tsc --noEmit` stays green.

**Interfaces:**
- Consumes: `cachedGetBillView`, `cachedGetBillsDueBy` (Task 2), `cachedGetSafeToSpend` (exists), `getNextPayoutDate` (Task 1), `toISODateString`; `BillView`, `BillsDueBy`, `SafeToSpendStatus` types.
- Produces (used by Tasks 6-8): `IncomePageClient` props gain `initialActiveTab: "income" | "bills"`, `billView?: BillView`, `billsDueBy?: BillsDueBy`.

- [ ] **Step 1: Read the Next 16 `page` conventions doc** — `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`, lines 67-120. Confirm: `searchParams` is `Promise<{ [key: string]: string | string[] | undefined }>` and must be awaited; using it opts the page into dynamic rendering.

- [ ] **Step 2: Rewrite `src/app/(dashboard)/income/page.tsx`**

```tsx
import { createClient, getUser } from "@/lib/supabase/server";
import { getIncomeEntries } from "@/lib/services/income.service";
import { cachedGetIncomeSources as getIncomeSources, cachedGetExpenseCategories as getExpenseCategories } from "@/lib/cache/shared-queries";
import { cachedGetPaychecks as getPaychecks, cachedGetLeanStatus as getLeanStatus, cachedGetSafeToSpend as getSafeToSpend, cachedGetBillView, cachedGetBillsDueBy } from "@/lib/cache/shared-queries";
import { getCurrentMonthYear } from "@/lib/utils/date";
import { getNextPayoutDate } from "@/lib/utils/bills";
import { toISODateString } from "@/lib/utils/date";
import { IncomePageClient } from "./income-page-client";

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const params = await searchParams;
  const activeTab = params.tab === "bills" ? "bills" : "income";

  const { month, year } = getCurrentMonthYear();
  const [incomeData, sources, paychecks, categories, leanStatus, safeToSpend] = await Promise.all([
    getIncomeEntries(supabase, user.id, { month, year, limit: 20 }),
    getIncomeSources(supabase, user.id),
    getPaychecks(supabase, user.id, month, year),
    getExpenseCategories(supabase, user.id),
    getLeanStatus(supabase, user.id),
    getSafeToSpend(supabase, user.id),
  ]);

  let billView = undefined as Awaited<ReturnType<typeof cachedGetBillView>> | undefined;
  let billsDueBy = undefined as Awaited<ReturnType<typeof cachedGetBillsDueBy>> | undefined;
  if (activeTab === "bills") {
    const horizon = toISODateString(getNextPayoutDate(new Date()));
    const todayPlus7 = new Date();
    todayPlus7.setDate(todayPlus7.getDate() + 7);
    const maxHorizon = toISODateString(getNextPayoutDate(new Date()) > todayPlus7 ? new Date() : todayPlus7);
    void horizon;
    [billView, billsDueBy] = await Promise.all([
      cachedGetBillView(supabase, user.id, year, month),
      cachedGetBillsDueBy(supabase, user.id, maxHorizon),
    ]);
  }

  const totalThisMonth = incomeData.data.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <IncomePageClient
      initialEntries={incomeData.data}
      sources={sources}
      paychecks={paychecks}
      categories={categories}
      leanStatus={leanStatus}
      safeToSpend={safeToSpend}
      totalThisMonth={totalThisMonth}
      currentMonth={month}
      currentYear={year}
      initialActiveTab={activeTab}
      billView={billView}
      billsDueBy={billsDueBy}
    />
  );
}
```

Simplify the horizon to exactly the spec's rule — **replace the `horizon`/`maxHorizon` scaffolding with**:

```ts
const now = new Date();
const nextPayout = toISODateString(getNextPayoutDate(now));
const todayPlus7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
const todayPlus7ISO = toISODateString(todayPlus7);
const horizon = todayPlus7ISO > nextPayout ? todayPlus7ISO : nextPayout;
```

and pass `horizon` to `cachedGetBillsDueBy`.

- [ ] **Step 3: Update `src/app/(dashboard)/income/income-page-client.tsx`**

Props interface additions:

```ts
interface IncomePageClientProps {
  // ...existing props unchanged
  initialActiveTab: "income" | "bills";
  billView?: BillView;
  billsDueBy?: BillsDueBy;
}
```

Inside the component: convert `initialActiveTab` to a tab state and render the second tab. The existing `Tabs` usage (`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` are already imported at line 12) extends to:

```tsx
<Tabs defaultValue={initialActiveTab} className="space-y-6">
  <TabsList className="grid w-full grid-cols-2 sm:w-auto">
    <TabsTrigger value="income">Income</TabsTrigger>
    <TabsTrigger value="bills">Bills</TabsTrigger>
  </TabsList>
  <TabsContent value="income">
    {/* existing content stays as-is, unchanged */}
  </TabsContent>
  <TabsContent value="bills">
    {billView && billsDueBy && safeToSpend ? (
      <div className="space-y-6">
        <BillsSummaryCard
          paidTotal={billsDueBy.paidTotal}
          upcomingTotal={billsDueBy.upcomingTotal}
          totalDue={billsDueBy.totalDue}
          horizonDate={billsDueBy.horizonDate}
          payoutDate={safeToSpend.payoutDate}
          safeToSpend={safeToSpend.safeToSpend}
        />
        <MonthCalendar
          bills={billView.bills}
          occurrences={billView.occurrences}
          payments={billView.payments}
          categories={categories}
          month={currentMonth}
          year={currentYear}
        />
        <BillsCrud
          bills={billView.bills}
          categories={categories}
        />
      </div>
    ) : (
      <div className="text-sm text-muted-foreground py-10 text-center">
        Load your bills from the Income tab.
      </div>
    )}
  </TabsContent>
</Tabs>
```

Add imports: `BillsSummaryCard` from `./bills-summary-card`, `MonthCalendar` from `./month-calendar`, `BillsCrud` from `./bills-crud`, and types `BillView`, `BillsDueBy` from `@/lib/types`.

- [ ] **Step 4: Verify types**

Run: `npx tsc --noEmit`
Expected: FAIL only on the three not-yet-created components (`bills-summary-card`, `month-calendar`, `bills-crud`) — this is expected until Tasks 6-8 land. Confirm the page/client wiring itself type-checks by comparing error surface to only those missing modules.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/income/page.tsx" "src/app/(dashboard)/income/income-page-client.tsx"
git commit -m "feat(bills): income page bills tab shell"
```

---

### Task 6: Before-next-paycheck summary card + pure verdict

**Files:**
- Create: `src/app/(dashboard)/income/bills-summary-card.tsx`
- Create: `src/lib/utils/bills-summary.ts` (pure)
- Test: `src/tests/bills-summary.test.ts`

**Interfaces:**
- Consumes: `SummaryVerdict`, `SafeToSpendStatus` types; `CurrencyDisplay`, `FintechCard`, `FintechCardContent` from existing components; `formatDate` from `@/lib/utils/date`.
- Produces (used by Task 9): `classifySummaryVerdict(upcomingTotal: number, safeToSpend: number): SummaryVerdict`.

- [ ] **Step 1: Write the failing test** — `src/tests/bills-summary.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { classifySummaryVerdict } from "@/lib/utils/bills-summary";

describe("classifySummaryVerdict", () => {
  it("covered when upcoming fits within safe-to-spend", () => {
    expect(classifySummaryVerdict(1000, 5000)).toBe("covered");
    expect(classifySummaryVerdict(0, 500)).toBe("covered");
  });
  it("tight when upcoming is within 25% over the comfortable band but ≤ remaining", () => {
    expect(classifySummaryVerdict(4200, 5000)).toBe("tight");
  });
  it("short when upcoming exceeds what's left, or nothing is left", () => {
    expect(classifySummaryVerdict(6000, 5000)).toBe("short");
    expect(classifySummaryVerdict(100, -50)).toBe("short");
    expect(classifySummaryVerdict(100, 0)).toBe("short");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tests/bills-summary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/utils/bills-summary.ts`**

```ts
import type { SummaryVerdict } from "@/lib/types";

// Mirrors the V2 color-language band: comfortable while a bill load uses
// ≤75% of remaining money (the app's BUDGET_THRESHOLDS.UNDER), tight up to
// 100%, short beyond. Uses only safeToSpend and the upcoming bill total.
export function classifySummaryVerdict(upcomingTotal: number, safeToSpend: number): SummaryVerdict {
  if (safeToSpend <= 0) return "short";
  if (upcomingTotal === 0) return "covered";
  const ratio = upcomingTotal / safeToSpend;
  if (ratio <= 0.75) return "covered";
  if (ratio <= 1) return "tight";
  return "short";
}
```

- [ ] **Step 4: Implement `src/app/(dashboard)/income/bills-summary-card.tsx`**

```tsx
"use client";

import { ReceiptText } from "lucide-react";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { classifySummaryVerdict } from "@/lib/utils/bills-summary";
import type { SummaryVerdict } from "@/lib/types";

const VERDICT: Record<
  SummaryVerdict,
  { label: string; pill: string; color: string }
> = {
  covered: {
    label: "Covered",
    pill: "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200/50",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  tight: {
    label: "Tight this cutoff",
    pill: "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200/50",
    color: "text-amber-500",
  },
  short: {
    label: "Short this cutoff",
    pill: "text-rose-700 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200/50",
    color: "text-rose-500",
  },
};

export function BillsSummaryCard({
  paidTotal,
  upcomingTotal,
  totalDue,
  horizonDate,
  payoutDate,
  safeToSpend,
}: {
  paidTotal: number;
  upcomingTotal: number;
  totalDue: number;
  horizonDate: string;
  payoutDate: string;
  safeToSpend: number;
}) {
  const verdict = classifySummaryVerdict(upcomingTotal, safeToSpend);
  const v = VERDICT[verdict];

  return (
    <FintechCard>
      <FintechCardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-slate-400" />
              Bills before next paycheck
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Due through {formatDate(horizonDate, "MMM d")} · paid {formatDate(payoutDate, "MMM d")}
            </p>
          </div>
          <span className={cn("text-[11px] font-semibold px-2.5 py-0.5 rounded-full border", v.pill)}>
            {v.label}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] text-muted-foreground">Paid this cutoff</p>
            <CurrencyDisplay value={paidTotal} className={cn("text-sm font-semibold")} />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Upcoming</p>
            <CurrencyDisplay value={upcomingTotal} className={cn("text-sm font-semibold", v.color)} />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Total</p>
            <CurrencyDisplay value={totalDue} className="text-sm font-semibold" />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {upcomingTotal > safeToSpend
            ? `Upcoming bills exceed what's left this cutoff.`
            : `What's left this cutoff (${formatDate(payoutDate, "MMM d")}) covers your upcoming bills.`}
        </p>
      </FintechCardContent>
    </FintechCard>
  );
}
```

- [ ] **Step 5: Run tests, expect PASS**

Run: `npx vitest run src/tests/bills-summary.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/bills-summary.ts src/tests/bills-summary.test.ts "src/app/(dashboard)/income/bills-summary-card.tsx"
git commit -m "feat(bills): before-next-paycheck summary card"
```

---

### Task 7: Month calendar + pay form

**Files:**
- Create: `src/app/(dashboard)/income/month-calendar.tsx`
- Create: `src/app/(dashboard)/income/pay-bill-form.tsx`
- Create: `src/lib/utils/calendar-cells.ts` (pure)
- Test: `src/tests/calendar-cells.test.ts`

**Interfaces:**
- Consumes: `Bill`, `BillOccurrence`, `BillPayment`; `payBill`/`unpayBill` actions (Task 4); `ExpenseCategory`; `listCutoffPeriodsBetween` from `pay-period.ts`; `dueSoonKey` not used here.
- Produces (used by Task 8 + live verify): `CalendarDayCell` type + `buildCalendarCells(year, month, occurrences, payments, today): CalendarDayCell[]`.

- [ ] **Step 1: Write the failing test** — `src/tests/calendar-cells.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { buildCalendarCells } from "@/lib/utils/calendar-cells";
import type { BillOccurrence } from "@/lib/types";

const occurrences: BillOccurrence[] = [
  { bill_id: "b1", billName: "Rent", dueDate: "2026-09-01", expectedAmount: 12000, cutoffPeriodEnd: "2026-09-13" },
  { bill_id: "b2", billName: "Electric", dueDate: "2026-09-20", expectedAmount: 1500, cutoffPeriodEnd: "2026-09-28" },
];

describe("buildCalendarCells", () => {
  it("marks paid, overdue, and today states per cell", () => {
    const cells = buildCalendarCells(
      2026, 8, // September 2026 (0-based month)
      occurrences,
      [{ id: "p1", bill_id: "b1", due_date: "2026-09-01", paid_at: "2026-09-01", amount: "12300", expense_id: null, created_at: "x", updated_at: "x" }],
      "2026-09-13"
    );
    const rentDay = cells.find((c) => c.date === "2026-09-01");
    const elecDay = cells.find((c) => c.date === "2026-09-20");
    expect(rentDay?.occurrences[0].paid).toBe(true);
    expect(elecDay?.occurrences[0].paid).toBe(false);
    expect(elecDay?.occurrences[0].overdue).toBe(false);
    expect(cells.find((c) => c.date === "2026-09-13")?.isToday).toBe(true);
  });

  it("tags cutoff anchor days", () => {
    const cells = buildCalendarCells(2026, 8, occurrences, [], "2026-09-13");
    const anchor = cells.find((c) => c.date === "2026-09-28");
    expect(anchor?.isCutoffAnchor).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tests/calendar-cells.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/utils/calendar-cells.ts`**

```ts
import { Bill, BillOccurrence, BillPayment } from "@/lib/types";
import { listCutoffPeriodsBetween } from "@/lib/utils/pay-period";
import { startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { toISODateString } from "@/lib/utils/date";

export interface CalendarDayCell {
  date: string;
  isInMonth: boolean;
  isToday: boolean;
  isCutoffAnchor: boolean;
  occurrences: Array<BillOccurrence & { paid: boolean; overdue: boolean }>;
}

export function buildCalendarCells(
  year: number,
  month: number, // 0-based
  occurrences: BillOccurrence[],
  payments: BillPayment[],
  todayISO: string
): CalendarDayCell[] {
  const first = startOfMonth(new Date(year, month, 1));
  const last = endOfMonth(new Date(year, month, 1));
  // pad leading week (Monday-start)
  const lead = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - lead);
  const days = eachDayOfInterval({ start: gridStart, end: last });

  const paid = new Set(payments.map((p) => `${p.bill_id}|${p.due_date}`));
  const anchors = new Set(
    listCutoffPeriodsBetween(first, last).map((p) => toISODateString(p.periodEnd))
  );

  return days.map((d) => {
    const iso = toISODateString(d);
    return {
      date: iso,
      isInMonth: d >= first && d <= last,
      isToday: iso === todayISO,
      isCutoffAnchor: anchors.has(iso),
      occurrences: occurrences
        .filter((o) => o.dueDate === iso)
        .map((o) => ({
          ...o,
          paid: paid.has(`${o.bill_id}|${o.dueDate}`),
          overdue: !paid.has(`${o.bill_id}|${o.dueDate}`) && iso < todayISO,
        })),
    };
  });
}
```

- [ ] **Step 4: Implement `src/app/(dashboard)/income/month-calendar.tsx`**

Client component. Renders the last-padded grid; each cell lists occurrence chips (name + amount, ✓ when paid, rose tint when overdue, dim when past-paid); cutoff anchors get a small dot marker; pending-bill click opens `PayBillForm`; paid chip click offers Unpay.

```tsx
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { buildCalendarCells } from "@/lib/utils/calendar-cells";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { PayBillForm } from "./pay-bill-form";
import type { Bill, BillOccurrence, BillPayment, ExpenseCategory } from "@/lib/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthCalendar({
  bills,
  occurrences,
  payments,
  categories,
  month,
  year,
}: {
  bills: Bill[];
  occurrences: BillOccurrence[];
  payments: BillPayment[];
  categories: ExpenseCategory[];
  month: number;
  year: number;
}) {
  const [viewMonth, setViewMonth] = useState(month - 1); // 0-based
  const [viewYear, setViewYear] = useState(year);
  const [payTarget, setPayTarget] = useState<(BillOccurrence & { paid: boolean; overdue: boolean }) | null>(null);

  const todayISO = formatDate(new Date(), "yyyy-MM-dd");
  const cells = buildCalendarCells(viewYear, viewMonth, occurrences, payments, todayISO);

  const shift = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  return (
    <FintechCard>
      <FintechCardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-400" /> Bills calendar
          </h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => shift(-1)} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium capitalize">{formatDate(new Date(viewYear, viewMonth, 1), "MMMM yyyy")}</span>
            <Button variant="ghost" size="sm" onClick={() => shift(1)} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell) => (
            <div
              key={cell.date}
              className={cn(
                "min-h-16 rounded-lg border p-1.5 text-xs",
                cell.isInMonth ? "bg-slate-50 dark:bg-slate-900" : "bg-transparent opacity-40",
                cell.isToday && "ring-2 ring-emerald-500/60"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium">{Number(cell.date.slice(8, 10))}</span>
                {cell.isCutoffAnchor && <span className="h-1 w-1 rounded-full bg-emerald-500" title="Cutoff anchor" />}
              </div>
              <div className="space-y-1 mt-1">
                {cell.occurrences.slice(0, 3).map((occ) => (
                  <button
                    key={`${occ.bill_id}-${occ.dueDate}`}
                    type="button"
                    onClick={() => setPayTarget(occ)}
                    className={cn(
                      "flex w-full items-center justify-between rounded px-1 py-0.5 text-left text-[10px] leading-tight",
                      occ.paid
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 opacity-70"
                        : occ.overdue
                          ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    <span className="truncate">{occ.billName}</span>
                    <span className="tabular-nums font-semibold">{occ.paid ? "✓" : <CurrencyDisplay value={occ.expectedAmount} className="inline text-[10px]" />}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {payTarget &&
          createPortal(
            <PayBillForm
              open
              onClose={() => setPayTarget(null)}
              occurrence={payTarget}
              categoryId={bills.find((b) => b.id === payTarget.bill_id)?.category_id ?? null}
              categories={categories}
            />,
            document.body
          )}
      </FintechCardContent>
    </FintechCard>
  );
}
```

- [ ] **Step 5: Implement `src/app/(dashboard)/income/pay-bill-form.tsx`**

A centered modal (reuse `ConfirmDialog` styling conventions, `useActionState` if the repo already uses it elsewhere; otherwise plain `useState` + action call + `toast`) that posts `payBill`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatDate } from "@/lib/utils/date";
import { payBill, unpayBill } from "./bills/actions";
import type { BillOccurrence, ExpenseCategory } from "@/lib/types";

export function PayBillForm({
  open,
  onClose,
  occurrence,
  categoryId,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  occurrence: BillOccurrence & { paid: boolean; overdue: boolean };
  categoryId: string | null;
  categories: ExpenseCategory[];
}) {
  const [amount, setAmount] = useState(String(occurrence.expectedAmount));
  const [selectedCategory, setSelectedCategory] = useState(categoryId ?? "");
  const [paidAt, setPaidAt] = useState(formatDate(new Date(), "yyyy-MM-dd"));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(String(occurrence.expectedAmount));
      setSelectedCategory(categoryId ?? "");
      setPaidAt(formatDate(new Date(), "yyyy-MM-dd"));
    }
  }, [open, occurrence, categoryId]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await payBill({
      billId: occurrence.bill_id,
      dueDate: occurrence.dueDate,
      paidAt,
      amount: Number(amount),
      categoryId: selectedCategory,
    });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(`${occurrence.billName} paid`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form className="w-full max-w-sm rounded-2xl bg-background p-5 space-y-4" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div>
          <h3 className="text-sm font-semibold">Pay {occurrence.billName}</h3>
          <p className="text-[11px] text-muted-foreground">
            Due {formatDate(occurrence.dueDate, "MMM d, yyyy")} · expected{" "}
            <CurrencyDisplay value={occurrence.expectedAmount} className="inline font-semibold" />
          </p>
        </div>
        <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} label="Amount paid" required />
        <select
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} label="Paid date" required />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Log payment"}</Button>
        </div>
      </form>
    </div>
  );
}
```

Note: verify `Input` in `src/components/ui/input.tsx` supports a `label` prop; if not, wrap with a manual `<label className="text-xs">` — inspect before finalizing. When the entry is already paid and the user clicks the chip, the same modal instead shows an "Unpay" button calling `unpayBill({ paymentId })` — `paid_at` lookup comes from `payments` in the parent; pass `paidPaymentId?: string` to the form when `occ.paid`.

- [ ] **Step 6: Run tests, expect PASS**

Run: `npx vitest run src/tests/calendar-cells.test.ts`
Expected: PASS.

- [ ] **Step 7: Verify the app still builds for typing**

Run: `npx tsc --noEmit`
Expected: any remaining errors are confined to `bills-crud` (Task 8) and pre-existing snags.

- [ ] **Step 8: Commit**

```bash
git add src/lib/utils/calendar-cells.ts src/tests/calendar-cells.test.ts "src/app/(dashboard)/income/month-calendar.tsx" "src/app/(dashboard)/income/pay-bill-form.tsx"
git commit -m "feat(bills): cutoff-aware month calendar and pay form"
```

---

### Task 8: Bills CRUD list

**Files:**
- Create: `src/app/(dashboard)/income/bills-crud.tsx`
- Create: `src/lib/utils/bill-profile.ts` (pure)
- Test: `src/tests/bill-profile.test.ts`

**Interfaces:**
- Consumes: `Bill`, `ExpenseCategory`; `createBillAction`, `updateBillAction`, `deleteBillAction` (Task 4).
- Produces: `billProfile(bill): { ready: boolean; missing: ("amount" | "day")[]; paused: boolean; label: "Incomplete" | "Paused" | null }` — used for status labels.

- [ ] **Step 1: Write the failing test** — `src/tests/bill-profile.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { billProfile } from "@/lib/utils/bill-profile";
import type { Bill } from "@/lib/types";

const base = (over: Partial<Bill> = {}): Bill => ({
  id: "b1", user_id: "u1", name: "Rent", expected_amount: "12000", category_id: null,
  day_of_month: 1, active: true, notes: null, created_at: "x", updated_at: "x", ...over,
});

describe("billProfile", () => {
  it("reports the missing field for incomplete bills", () => {
    expect(billProfile(base({ expected_amount: null }))).toMatchObject({ ready: false, missing: ["amount"] });
    expect(billProfile(base({ day_of_month: null }))).toMatchObject({ ready: false, missing: ["day"] });
    expect(billProfile(base())).toMatchObject({ ready: true, missing: [] });
  });
  it("flags paused distinctly from incomplete", () => {
    expect(billProfile(base({ active: false }))).toMatchObject({ paused: true, ready: true });
    expect(billProfile(base({ active: false, expected_amount: null }))).toMatchObject({ paused: true, ready: false, missing: ["amount"] });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tests/bill-profile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/utils/bill-profile.ts`**

```ts
import type { Bill } from "@/lib/types";

export type BillProfile = {
  ready: boolean;
  missing: Array<"amount" | "day">;
  paused: boolean;
  label: "Incomplete" | "Paused" | null;
};

export function billProfile(bill: Bill): BillProfile {
  const missing: BillProfile["missing"] = [];
  if (bill.expected_amount == null) missing.push("amount");
  if (bill.day_of_month == null) missing.push("day");
  const ready = missing.length === 0;
  const paused = !bill.active;
  return {
    ready,
    missing,
    paused,
    label: !ready ? "Incomplete" : paused ? "Paused" : null,
  };
}
```

- [ ] **Step 4: Implement `src/app/(dashboard)/income/bills-crud.tsx`**

Client component. Row per bill (all bills — the raw array), status chip from `billProfile`, inline edit (name/amount/day/category/toggle/delete), "Add bill" button using `createBillAction`, seeded templates render here as `Incomplete`. Use the `useOptimistic`/`useTransition` pattern already present in `income-page-client.tsx:49-80` and `toast` for action errors.

```tsx
"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Power, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { billProfile } from "@/lib/utils/bill-profile";
import { createBillAction, updateBillAction, deleteBillAction } from "./bills/actions";
import type { Bill, ExpenseCategory } from "@/lib/types";

const STATUS_STYLE: Record<string, string> = {
  Incomplete: "bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400",
  Paused: "bg-slate-100 text-slate-500 border-slate-200/60 dark:bg-slate-800 dark:text-slate-400",
};

export function BillsCrud({ bills, categories }: { bills: Bill[]; categories: ExpenseCategory[] }) {
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; expected_amount: string; day_of_month: string; category_id: string }>({
    name: "", expected_amount: "", day_of_month: "", category_id: "",
  });

  const startAdd = () => { setAdding(true); setEditingId(null); setDraft({ name: "", expected_amount: "", day_of_month: "", category_id: "" }); };
  const startEdit = (b: Bill) => { setEditingId(b.id); setAdding(false); setDraft({
    name: b.name,
    expected_amount: b.expected_amount ?? "",
    day_of_month: b.day_of_month != null ? String(b.day_of_month) : "",
    category_id: b.category_id ?? "",
  }); };

  function togglePause(b: Bill) {
    startTransition(async () => {
      const res = await updateBillAction({
        id: b.id,
        name: b.name,
        expected_amount: b.expected_amount ?? "",
        day_of_month: b.day_of_month ?? "",
        category_id: b.category_id ?? "",
        active: !b.active,
      });
      if (res.error) toast.error(res.error);
    });
  }

  return (
    <FintechCard>
      <FintechCardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Bills</h3>
          <Button size="sm" variant="outline" onClick={adding ? () => setAdding(false) : startAdd}>
            <Plus className="h-3.5 w-3.5" /> {adding ? "Cancel" : "Add bill"}
          </Button>
        </div>

        {adding && (
          <form
            className="space-y-3 rounded-xl border p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await createBillAction({
                name: draft.name,
                expected_amount: draft.expected_amount,
                day_of_month: draft.day_of_month,
                category_id: draft.category_id,
              });
              if (res.error) return toast.error(res.error);
              toast.success("Bill added");
              setAdding(false);
            }}
          >
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name (e.g. Electricity)" required />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" min="0.01" step="0.01" value={draft.expected_amount} onChange={(e) => setDraft({ ...draft, expected_amount: e.target.value })} placeholder="Expected amount" />
              <Input type="number" min="1" max="31" value={draft.day_of_month} onChange={(e) => setDraft({ ...draft, day_of_month: e.target.value })} placeholder="Due day (1-31)" />
            </div>
            <select className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Button type="submit" size="sm">Save bill</Button>
          </form>
        )}

        <div className="space-y-2">
          {bills.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No bills yet. Add one or activate a template.</p>}
          {bills.map((b) => {
            const profile = billProfile(b);
            return (
              <div key={b.id} className={editingId === b.id ? "rounded-xl border p-3 space-y-2" : "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"}>
                {editingId === b.id ? (
                  <form className="space-y-2 flex-1" onSubmit={async (e) => {
                    e.preventDefault();
                    const res = await updateBillAction({ id: b.id, ...draft });
                    if (res.error) return toast.error(res.error);
                    toast.success("Bill saved");
                    setEditingId(null);
                  }}>
                    <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="number" min="0.01" step="0.01" value={draft.expected_amount} onChange={(e) => setDraft({ ...draft, expected_amount: e.target.value })} />
                      <Input type="number" min="1" max="31" value={draft.day_of_month} onChange={(e) => setDraft({ ...draft, day_of_month: e.target.value })} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button type="submit" size="sm">Save</Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={b.active ? "text-sm font-medium" : "text-sm font-medium text-muted-foreground line-through"}>{b.name}</span>
                        {profile.label && <Badge variant="outline" className={STATUS_STYLE[profile.label]}>{profile.label}</Badge>}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {profile.missing.length === 0 ? (
                          <>
                            Due day {b.day_of_month} · <CurrencyDisplay value={Number(b.expected_amount)} className="inline font-semibold" />
                          </>
                        ) : (
                          <>Set {profile.missing.join(" and ")} to activate</>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(b)} aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => togglePause(b)} aria-label={b.active ? "Pause" : "Resume"}><Power className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={async () => {
                        const res = await deleteBillAction({ id: b.id });
                        if (res.error) return toast.error(res.error);
                        toast.success("Bill deleted");
                      }} aria-label="Delete"><Trash2 className="h-3.5 w-3.5 text-rose-500" /></Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </FintechCardContent>
    </FintechCard>
  );
}
```

- [ ] **Step 5: Run tests, expect PASS**

Run: `npx vitest run src/tests/bill-profile.test.ts`
Expected: PASS.

- [ ] **Step 6: Full typecheck of the feature surface**

Run: `npx tsc --noEmit`
Expected: PASS (all Tasks 5-8 modules now exist).

- [ ] **Step 7: Commit**

```bash
git add src/lib/utils/bill-profile.ts src/tests/bill-profile.test.ts "src/app/(dashboard)/income/bills-crud.tsx"
git commit -m "feat(bills): CRUD list with activate, pause, edit, delete"
```

---

### Task 9: Drawer notifications

**Files:**
- Modify: `src/lib/services/notification.service.ts`
- Test: `src/tests/notification-bills.test.ts`

**Interfaces:**
- Consumes: `getBillsDueBy` (Task 2), `getSafeToSpend` from `@/lib/services/safe-to-spend.service` (exists, uncached read-time fine here), `dueSoonKey` (Task 1), `formatDate`; `NotificationItem` (same file).
- Produces: two `NotificationItem`s with exact IDs `bills-due-soon-<hash>` and `bills-coverage-<periodEnd>` appended to `getDynamicNotifications`.

- [ ] **Step 1: Write the failing test** — `src/tests/notification-bills.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { dueSoonKey } from "@/lib/utils/bills";

describe("due-soon notification key stability (spec §8)", () => {
  it("same qualifying set ⇒ same key", () => {
    const a = [{ bill_id: "1", dueDate: "2026-09-15", expectedAmount: 100 }];
    expect(dueSoonKey(a)).toBe(dueSoonKey(a));
  });
  it("bill paid (exits) / new entry / amount edit ⇒ new key", () => {
    const base = [{ bill_id: "1", dueDate: "2026-09-15", expectedAmount: 100 }];
    expect(dueSoonKey(base)).not.toBe(dueSoonKey([]));
    expect(dueSoonKey(base)).not.toBe(dueSoonKey([{ bill_id: "2", dueDate: "2026-09-18", expectedAmount: 500 }]));
    expect(dueSoonKey(base)).not.toBe(dueSoonKey([{ bill_id: "1", dueDate: "2026-09-15", expectedAmount: 250 }]));
  });
});
```

- [ ] **Step 2: Run to verify the contract exists**

Run: `npx vitest run src/tests/notification-bills.test.ts`
Expected: PASS (guards the key contract; the wiring below is verified live + by existing suite).

- [ ] **Step 3: Wire the two alerts into `getDynamicNotifications`**

In `src/lib/services/notification.service.ts`:

Add imports:

```ts
import { getBillsDueBy } from "./bills.service";
import { getSafeToSpend } from "./safe-to-spend.service";
import { dueSoonKey } from "@/lib/utils/bills";
```

Extend the existing `Promise.all` (lines 31-38) with two more members and destructure them; then append section 7 before the dismiss filter (line 146):

```ts
  // 7. Bills (K2): due-soon + coverage nudge
  if (funds && billsDue) {
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const plus7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const dueSoonOcc = billsDue.occurrences.filter(
      (o) => o.dueDate >= todayISO && o.dueDate <= plus7
    );
    if (dueSoonOcc.length > 0) {
      const total = dueSoonOcc.reduce((s, o) => s + o.expectedAmount, 0);
      list.push({
        id: dueSoonKey(dueSoonOcc.map((o) => ({ bill_id: o.bill_id, dueDate: o.dueDate, expectedAmount: o.expectedAmount }))),
        type: "warning",
        title: "Bills Due Soon",
        message: `${dueSoonOcc.length} bill${dueSoonOcc.length === 1 ? "" : "s"} due in the next 7 days · ₱${total.toLocaleString()} total`,
        date: new Date().toISOString(),
      });
    }

    if (billsDue.upcomingTotal > funds.safeToSpend) {
      const shortfall = Math.round(billsDue.upcomingTotal - funds.safeToSpend);
      list.push({
        id: `bills-coverage-${funds.periodEnd}`,
        type: "warning",
        title: "Bills before Next Paycheck",
        message: `Bills before your ${formatDate(funds.payoutDate, "MMM d")} payout exceed what's left this cutoff by ₱${shortfall.toLocaleString()}.`,
        date: new Date().toISOString(),
      });
    }
  }
```

For the Promise.all, the added members are:

```ts
    getSafeToSpend(supabase, userId).catch(() => null),   // → funds
    (async () => {
      const fundsRes = await getSafeToSpend(supabase, userId).catch(() => null);
      if (!fundsRes) return null;
      const todayISO = new Date().toISOString().slice(0, 10);
      const todayPlus7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const horizon = todayPlus7 > fundsRes.payoutDate ? todayPlus7 : fundsRes.payoutDate;
      return getBillsDueBy(supabase, userId, horizon).catch(() => null); // → billsDue
    })(),
```

(the second member resolves `billsDue`; both run inside the same `Promise.all`, keeping the read-time guarantee. `fundsRes` computed once for both due-soon and coverage so the coverage comparison uses the payoff-derived horizon.)

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS (125 existing + new files). Ensure no existing notification tests regressed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/notification.service.ts src/tests/notification-bills.test.ts
git commit -m "feat(bills): due-soon and coverage drawer alerts"
```

---

### Task 10: Full gates

**Files:** none

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS, 0 errors.

- [ ] **Step 2: Unit tests**

Run: `npm test`
Expected: PASS — all existing 125 + new (`bills`, `bills.service`, `bills-actions`, `bills-summary`, `calendar-cells`, `bill-profile`, `notification-bills`) suites.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: PASS, "0 error" and "0 warnings".

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: PASS, 19+ static pages (no new top-level route — the tab is inside `/income`).

- [ ] **Step 5: Bump default-user fixtures pass note (no commit)**

If any existing test hard-codes income-page client props, update it to the new required `initialActiveTab` prop (default-fallback in the component is acceptable; do not add unrelated refactors).

- [ ] **Step 6: Commit (only if files changed)**

```bash
git add -A
git commit -m "chore(bills): gates clean for K2"
```

If no files changed in Steps 1-5, skip this commit.

---

### Task 11: Apply 008 to cloud + verify schema, RLS, seeding, RPCs

**Files:** none (ops task against the cloud project `jaaeeyeyidvekzdssqfv`).

**Prerequisite:** the env var `SUPABASE_PAT_K2` is set to the user's newly-created scoped token (Database read-write). If it is not set, stop and ask the user to `$env:SUPABASE_PAT_K2 = "<token from store>"` in the shell (never type the token into a file or chat).

- [ ] **Step 1: Guard the credential**

Run: `if (-not $env:SUPABASE_PAT_K2) { Write-Error "Set SUPABASE_PAT_K2 first" }`
Expected: no error.

- [ ] **Step 2: Apply the migration via Management API** (007 pattern — body `{ name, query }` to `POST /v1/projects/{ref}/database/migrations`; pass the SQL as a file to `curl.exe -d @file` with `ConvertTo-Json` avoided):

```powershell
$body = @{ name = "008_bills_schema"; query = (Get-Content -Raw -LiteralPath "supabase/migrations/008_bills_schema.sql") } | ConvertTo-Json -Compress
Set-Content -LiteralPath "$env:TEMP\opencode\migrate-008.json" -Value $body -Encoding UTF8
curl.exe -s -o "$env:TEMP\opencode\migrate-008-out.json" -w "%{http_code}" `
  "https://api.supabase.com/v1/projects/jaaeeyeyidvekzdssqfv/database/migrations" `
  -H "Authorization: Bearer $env:SUPABASE_PAT_K2" -H "Content-Type: application/json" `
  -d "@$env:TEMP\opencode\migrate-008.json"
```

Expected: HTTP 201. On failure, read the response body and fix the SQL before retrying.

- [ ] **Step 3: Verify schema + RLS + functions** via `POST /v1/projects/{ref}/database/query`:

Query 1 — tables/columns:

```sql
SELECT table_name, column_name, is_nullable FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('bills','bill_payments')
ORDER BY table_name, ordinal_position;
```

Expected: `bills` (`expected_amount`, `day_of_month` nullable), `bill_payments` (`amount` NOT NULL, `due_date` NOT NULL).

Query 2 — RLS:

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('bills','bill_payments');
```

Expected: `true` for both.

Query 3 — functions:

```sql
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('pay_bill','unpay_bill');
```

Expected: both rows present.

- [ ] **Step 4: Verify seeding trigger shape** (function body replays 001 + bills):

```sql
SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure) LIKE '%Postpaid/Phone%';
```

Expected: `true`.

- [ ] **Step 5: Commit any incidental fixes**

If Steps 2-4 required SQL corrections, commit them:

```bash
git add supabase/migrations/008_bills_schema.sql
git commit -m "fix(bills): migration corrections from cloud apply"
```

Otherwise no commit.

---

### Task 12: Live verification (CDP on prod) + verification commit

**Files:** none (verification only).
**Prereqs:** prod deployed — run `vercel deploy --target production --yes` first and wait for a healthy preview of the production URL; QA account fixtures from V2 are present (paycheck ₱15,000 period_end 2026-09-13, incentive ₱2,500, expenses ₱110 → `safeToSpend` ₱17,390). CDP on `ws://127.0.0.1:9228` (QA profile), helpers in `$env:TEMP\opencode`.

- [ ] **Step 1: Deploy**

Run: `vercel deploy --target production --yes`
Expected: deployment URL printed and healthy.

- [ ] **Step 2: Activate a seeded template**

On `https://money-map-ph.vercel.app/income?tab=bills`: confirm the Bills tab renders the summary + calendar + CRUD; the seeded templates show `Incomplete`; activate "Internet" by setting amount (₱1,500) + day (25) → its `Incomplete` badge disappears and it appears on the calendar. Screenshot `verification/v3-01-tab+activate.png`.

- [ ] **Step 3: Pay-flow + expense linkage**

Pay Internet's September occurrence from the calendar at a **different** amount (₱1,767) → toast success; open `/expenses` and verify an `Internet ₱1,767` row exists, **dated paidAt**. Return to the Bills tab: the summary **Paid** figure includes ₱1,767 (actual, not ₱1,500 — "actual beats forecast"). Screenshots `v3-02-paid-summary.png`, `v3-03-expense-linked.png`.

- [ ] **Step 4: Double-pay rejection**

Attempt to pay the same occurrence again → action surfaces the duplicate error; toast shows "This occurrence is already paid." Screenshot `v3-04-double-pay.png`.

- [ ] **Step 5: Unpay symmetry**

Unpay the Internet payment → the expense disappears from `/expenses`; the calendar chip returns to unpaid. Screenshot `v3-05-unpay.png`.

- [ ] **Step 6: Pause + incomplete exclusion**

Pause "Electricity" (activate first with amount ₱2,900, day 5) → it vanishes from calendar + summary but remains in the CRUD list labeled `Paused`. Set its amount to blank → reverts to `Incomplete` and never appears in summary/calendar. Screenshot `v3-06-paused-incomplete.png`.

- [ ] **Step 7: Calendar markers**

Confirm the current month shows cutoff-anchor dots on the 13th and 28th and (where the displayed month contains a payout) the payout chevron rendering. Screenshot `v3-07-markers.png`.

- [ ] **Step 8: Drawer alerts**

Craft bills so one is due within 7 days → open the notifications drawer → "Bills Due Soon" present with count + total ("actual content"; note the exact `id` begins `bills-due-soon-`). Then force a short cutoff (add a large expense ~₱20,000 in the current period) → "Bills before Next Paycheck" appears (id `bills-coverage-<periodEnd>`). Dismiss both, reload — the same cutoff does not resurrect them (stable IDs). Screenshots `v3-08-due-soon.png`, `v3-09-coverage-short.png`.

- [ ] **Step 9: Restore QA fixtures**

Remove the temporary large expense and the test Internet/Electricity bills/payments so the QA account returns to the V2 baseline (paycheck ₱15,000 / incentive ₱2,500 / expenses ₱110 → safe-to-spend ₱17,390). Re-verify the summary total on the Bills tab reads objectively (Paid re-computed from remaining seeded templates only).

- [ ] **Step 10: Verification commit**

```bash
git add -A
git commit -m "feat(verify): K2 bills calendar live-verified"
```

Push `master`. Note in the commit body any deferred live checks (e.g., rollover-dependent states that require ≥ 2026-09-14).

---

## Self-Review Notes

- **Spec coverage:** each spec § section maps to a task — §2 schema → T3; §3 engine → T1; §4 service/cache → T2; §5 actions → T4; §6 route → T5, summary → T6, calendar/pay → T7, CRUD → T8; §7 notifications + IDs → T9; §8 tests/migration/live → T1-T12. §9 "explicitly untouched" honored (Global Constraints 5-6). Spec §9 listed modifying `001`; Global Constraint 8 documents the 008-only deviation and why (live-DB convergence).
- **Placeholder scan:** T2's Step 3 contains a placeholder marked "implemented in Step 4 — do not commit"; no other TODO/TBD. All component code is concrete.
- **Type consistency:** `Bill`, `BillOccurrence`, `BillView`, `BillsDueBy`, `SummaryVerdict` defined once in T1 and referenced identically thereafter; `dueSoonKey` returns `bills-due-soon-<hex>`; coverage id literal `bills-coverage-${funds.periodEnd}` matches the spec exactly. `getBillsDueBy` signature and `paidTotal`/`upcomingTotal`/`totalDue` names are stable across T2/T6/T9.