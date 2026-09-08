# V1 — Pay-Period Engine + Lean-Cutoff Detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 13th/28th cutoff pay-period engine with explicit `paychecks.period_end` attribution, a trailing-median lean-cutoff classifier, and minimal signal surfaces (Income-page chip + notification drawer), leaving monthly budgets/financials authoritative.

**Architecture:** Compute-only overlay. A pure date utility derives cutoff periods (14/28 anchors, weekend → preceding Friday). `paychecks` gains an explicit `period_end` column (migration 006 with SQL backfill). A service rolls up core paycheck income per period, classifies the last completed period against the trailing median (default 0.75 threshold, ≥6 logged periods), cached via the existing `unstable_cache` wrapper pattern. Surfaced as a chip on the Income page and a warning via the existing in-app notification pipeline.

**Tech Stack:** Next.js 16.2.12, React 19.2.4, TypeScript, Supabase (Postgres), date-fns (v4, bundled in `node_modules`), Zod, Vitest. Check `node_modules/next/dist/docs/` before touching Server Actions / `next/cache` behavior. Tests: `npx vitest run`. Quality gates: `npm run lint`, `npx tsc --noEmit`, `npm run build`.

**Spec:** `docs/superpowers/specs/2026-09-08-pay-period-engine-lean-detection-design.md`

## Global Constraints

- Cutoff anchors are the **13th and 28th of every month**, fixed as worked-period boundaries. Period A = `[prev-month 29th .. 13th]`; Period B = `[14th .. 28th]`; the 29th–31st belong to the **next month's** 13th cutoff.
- Payday = the anchor date unless it is Saturday (`getDay() === 6` → minus 1 day) or Sunday (`getDay() === 0` → minus 2 days) — i.e., **preceding Friday**.
- Core income per period = `SUM(paychecks.amount)` grouped by `period_end`, paychecks only. **Incentives/supplemental income are excluded in V1** (no `income_entries` involvement).
- Lean phase only when `periods.length >= 6` (logged periods) and `ratio < LEAN_CUTOFF_THRESHOLD` (0.75 strict-less-than). Ratio `=== 0.75` is **normal**, never lean.
- Periods with no logged paycheck are excluded from the window and are never classified lean. NULL `period_end` rows are excluded everywhere.
- The target is the newest **completed** period (payout date ≤ now) that has ≥1 paycheck; an in-flight unpaid current period is never the target.
- Monthly snapshots/budgets/Health Score remain authoritative: **do not modify** `financial.service`, `snapshot.service`, `forecast.service`, or `goal.service` business logic.
- No settings UI for the threshold in V1; no incentive display, no budget tightening, no dashboard widget.
- All money shown in UI via `CurrencyDisplay` (component) or `toLocaleString()` (string messages).

---

### Task 1: Migration 006 — `period_end` column + index + SQL backfill

**Files:**
- Create: `supabase/migrations/006_pay_period_engine.sql`

**Interfaces:**
- Produces: `public.paychecks.period_end DATE` (nullable). Existing rows backfilled to the cutoff whose weekend-shifted payout equals `paychecks.date`; unmatchable rows stay NULL. RLS unchanged.

- [ ] **Step 1: Create the migration file**

Write `supabase/migrations/006_pay_period_engine.sql`:

```sql
-- ============================================================
-- PAY PERIOD ENGINE
-- Adds explicit cutoff attribution to paychecks (V1 lean detection)
-- ============================================================

ALTER TABLE public.paychecks ADD COLUMN period_end DATE;

CREATE INDEX idx_paychecks_user_period_end ON public.paychecks(user_id, period_end);

-- Backfill: for each paycheck, pick the cutoff anchor (prev-month 28th,
-- this-month 13th, this-month 28th, next-month 13th) whose weekend-shifted
-- payout date equals paychecks.date. Rows matching no candidate stay NULL.
-- Weekday shift: Saturday (DOW 6) -> -1 day, Sunday (DOW 0) -> -2 days.
UPDATE public.paychecks AS p
SET period_end = cand.pe
FROM (
  SELECT
    p0.id AS id,
    c.pe AS pe,
    CASE
      WHEN extract(DOW FROM c.pe) = 6 THEN c.pe - 1
      WHEN extract(DOW FROM c.pe) = 0 THEN c.pe - 2
      ELSE c.pe
    END AS payout
  FROM public.paychecks p0
  CROSS JOIN LATERAL (
    SELECT (make_date(EXTRACT(YEAR FROM p0.date)::int, EXTRACT(MONTH FROM p0.date)::int, 28) - INTERVAL '1 month')::date AS pe
    UNION ALL
    SELECT make_date(EXTRACT(YEAR FROM p0.date)::int, EXTRACT(MONTH FROM p0.date)::int, 13)
    UNION ALL
    SELECT make_date(EXTRACT(YEAR FROM p0.date)::int, EXTRACT(MONTH FROM p0.date)::int, 28)
    UNION ALL
    SELECT (make_date(EXTRACT(YEAR FROM p0.date)::int, EXTRACT(MONTH FROM p0.date)::int, 13) + INTERVAL '1 month')::date AS pe
  ) AS c
) AS cand
WHERE p.id = cand.id AND p.date = cand.payout;
```

- [ ] **Step 2: Sanity-check the SQL (no runtime yet)**

Read back the file; confirm: column added before the index; index name unique; backfill matches app logic in Task 2 (Saturday −1, Sunday −2); RLS untouched.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_pay_period_engine.sql
git commit -m "chore(db): add paychecks.period_end + backfill migration"
```

> Application to the Supabase cloud database happens in Task 9 (one shot, after all migration consumers exist).

---

### Task 2: Pure pay-period date engine + tests

**Files:**
- Create: `src/lib/utils/pay-period.ts`
- Test: `src/tests/pay-period.test.ts`

**Interfaces:**
- Produces:
  - `CUTOFF_ANCHOR_DAYS = [13, 28] as const`
  - `interface CutoffPeriod { periodEnd: Date; periodStart: Date; payoutDate: Date }`
  - `getCutoffPeriodForDate(date: Date): CutoffPeriod`
  - `getPayoutDateForPeriodEnd(periodEnd: Date): Date`
  - `getPeriodRange(periodEnd: Date): { periodStart: Date; periodEnd: Date }`
  - `listCutoffPeriodsBetween(start: Date, end: Date): CutoffPeriod[]` (ascending by `periodEnd`)
  - `estimatePeriodEndForPayout(payoutDate: Date): Date`

- [ ] **Step 1: Write the failing test**

Create `src/tests/pay-period.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  CUTOFF_ANCHOR_DAYS,
  getCutoffPeriodForDate,
  getPayoutDateForPeriodEnd,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/tests/pay-period.test.ts`
Expected: FAIL — module `pay-period.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/utils/pay-period.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/tests/pay-period.test.ts`
Expected: PASS (all cases). Fix any weekday mismatches in the *test* matrix first — the frozen days were verified: 2026-09-13 Sun, 2026-11-28 Sat, 2026-12-13 Sun, 2027-02-13 Sat, 2026-09-28 Mon, 2026-10-13 Tue.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/pay-period.ts src/tests/pay-period.test.ts
git commit -m "feat: add pure 13th/28th cutoff pay-period date engine"
```

---

### Task 3: Lean classification service + types + constants + cached wrapper

**Files:**
- Modify: `src/lib/constants.ts:1-7`
- Modify: `src/lib/types/index.ts` (add `LeanPhase`, `LeanStatus`)
- Create: `src/lib/services/pay-period.service.ts`
- Modify: `src/lib/cache/shared-queries.ts:1-95`
- Test: `src/tests/pay-period.service.test.ts`

**Interfaces:**
- Consumes: from Task 2 — `getCutoffPeriodForDate`, `getPayoutDateForPeriodEnd(periodEnd: Date): Date`, `listCutoffPeriodsBetween`, `CutoffPeriod`.
- Produces:
  - `interface CutoffIncome { periodEnd: string; income: number }` (ISO `yyyy-MM-dd`)
  - `getTrailingCutoffIncomes(supabase, userId, windowPeriods = 24, now = new Date()): Promise<CutoffIncome[]>` — descending by `periodEnd`, one entry per logged period (≥1 paycheck), NULL `period_end` excluded.
  - `getPeriodCoreIncome(supabase, userId, periodEnd: string): Promise<number>`
  - `getLeanStatus(supabase, userId, now = new Date()): Promise<LeanStatus>`
    - `LeanStatus = { phase: "insufficient" | "normal" | "lean"; targetPeriodEnd: string | null; targetIncome: number; median: number; ratio: number | null; threshold: number; periodsUsed: number; windowPeriods: number }`
  - `cachedGetLeanStatus(supabase, userId): Promise<LeanStatus>` (cache tag `q:lean:<userId>`, revalidate 60).

- [ ] **Step 1: Write the failing tests**

Create `src/tests/pay-period.service.test.ts` (notes: `now` is injected for hermetic tests; string-based ISO date filtering mirrors real query semantics):

```ts
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
  return { id: `p-${periodEnd}-${amount}`, period_end: periodEnd, amount, date };
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
      { id: "legacy", period_end: null, amount: 7000, date: "2026-08-14" },
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/pay-period.service.test.ts`
Expected: FAIL — module and constants do not exist yet.

- [ ] **Step 3: Add constants**

In `src/lib/constants.ts`, after `BUDGET_THRESHOLDS` (line 6):

```ts
export const LEAN_CUTOFF_THRESHOLD = 0.75;
export const MIN_LEAN_PERIODS = 6;
export const LEAN_WINDOW_PERIODS = 24;
```

- [ ] **Step 4: Add types**

In `src/lib/types/index.ts`, after the `BudgetStatus` interface (line 143):

```ts
export type LeanPhase = "insufficient" | "normal" | "lean";

export interface LeanStatus {
  phase: LeanPhase;
  targetPeriodEnd: string | null;
  targetIncome: number;
  median: number;
  ratio: number | null;
  threshold: number;
  periodsUsed: number;
  windowPeriods: number;
}
```

- [ ] **Step 5: Implement the service**

Create `src/lib/services/pay-period.service.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { parseISO } from "date-fns";
import { toISODateString } from "@/lib/utils/date";
import {
  getCutoffPeriodForDate,
  getPayoutDateForPeriodEnd,
  listCutoffPeriodsBetween,
} from "@/lib/utils/pay-period";
import { LEAN_CUTOFF_THRESHOLD, LEAN_WINDOW_PERIODS, MIN_LEAN_PERIODS } from "@/lib/constants";
import type { LeanStatus } from "@/lib/types";

export interface CutoffIncome {
  periodEnd: string;
  income: number;
}

export async function getTrailingCutoffIncomes(
  supabase: SupabaseClient,
  userId: string,
  windowPeriods: number = LEAN_WINDOW_PERIODS,
  now: Date = new Date()
): Promise<CutoffIncome[]> {
  const current = getCutoffPeriodForDate(now);
  const cutoffs = listCutoffPeriodsBetween(
    new Date(now.getFullYear(), now.getMonth(), Math.max(now.getDate() - windowPeriods * 33, 1)),
    current.periodEnd
  ).slice(-windowPeriods);

  const windowStart = cutoffs[0]?.periodStart ?? now;

  const { data, error } = await supabase
    .from("paychecks")
    .select("period_end, amount")
    .eq("user_id", userId)
    .not("period_end", "is", null)
    .gte("date", toISODateString(windowStart))
    .lte("date", toISODateString(current.periodEnd))
    .order("date", { ascending: false });

  if (error) throw error;

  const byPeriod = new Map<string, number>();
  (data || []).forEach((row) => {
    const pe = row.period_end as string;
    byPeriod.set(pe, (byPeriod.get(pe) || 0) + Number(row.amount));
  });

  return Array.from(byPeriod.entries())
    .map(([periodEnd, income]) => ({ periodEnd, income }))
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
}

export async function getPeriodCoreIncome(
  supabase: SupabaseClient,
  userId: string,
  periodEnd: string
): Promise<number> {
  const incomes = await getTrailingCutoffIncomes(supabase, userId);
  return incomes.find((p) => p.periodEnd === periodEnd)?.income ?? 0;
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function getLeanStatus(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<LeanStatus> {
  const periods = await getTrailingCutoffIncomes(supabase, userId, LEAN_WINDOW_PERIODS, now);

  const nowMs = now.getTime();
  const target = periods.find((p) => getPayoutDateForPeriodEnd(parseISO(p.periodEnd)).getTime() <= nowMs) ?? null;

  if (!target) {
    return {
      phase: "insufficient",
      targetPeriodEnd: null,
      targetIncome: 0,
      median: 0,
      ratio: null,
      threshold: LEAN_CUTOFF_THRESHOLD,
      periodsUsed: periods.length,
      windowPeriods: LEAN_WINDOW_PERIODS,
    };
  }

  if (periods.length < MIN_LEAN_PERIODS) {
    return {
      phase: "insufficient",
      targetPeriodEnd: target.periodEnd,
      targetIncome: target.income,
      median: 0,
      ratio: null,
      threshold: LEAN_CUTOFF_THRESHOLD,
      periodsUsed: periods.length,
      windowPeriods: LEAN_WINDOW_PERIODS,
    };
  }

  const window = periods.slice(0, LEAN_WINDOW_PERIODS);
  const median = medianOf(window.map((p) => p.income));
  const ratio = median > 0 ? target.income / median : 0;
  const phase = ratio < LEAN_CUTOFF_THRESHOLD ? "lean" : "normal";

  return {
    phase,
    targetPeriodEnd: target.periodEnd,
    targetIncome: target.income,
    median,
    ratio,
    threshold: LEAN_CUTOFF_THRESHOLD,
    periodsUsed: window.length,
    windowPeriods: LEAN_WINDOW_PERIODS,
  };
}
```

- [ ] **Step 6: Add the cached wrapper**

In `src/lib/cache/shared-queries.ts`, add the import (with the existing `getPaychecks` import, line 7):

```ts
import { getLeanStatus } from "@/lib/services/pay-period.service";
```

Extend the type import block (line 8–16) with `LeanStatus`:

```ts
  LeanStatus,
```

Append after `cachedGetPaychecks` (line 95):

```ts
export const cachedGetLeanStatus = (
  supabase: SupabaseClient,
  userId: string
): Promise<LeanStatus> =>
  unstable_cache(
    async () => getLeanStatus(supabase, userId),
    ["lean-status", userId],
    { revalidate: REVALIDATE_SECONDS, tags: [`q:lean:${userId}`, "q:financial"] }
  )();
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/tests/pay-period.service.test.ts src/tests/pay-period.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/lib/constants.ts src/lib/types/index.ts src/lib/services/pay-period.service.ts src/lib/cache/shared-queries.ts src/tests/pay-period.service.test.ts
git commit -m "feat: add trailing-median lean-cutoff classifier with caching"
```

---

### Task 4: `createPaycheck` writes `period_end` (types + service + tests)

**Files:**
- Modify: `src/lib/types/index.ts` (extend `Paycheck`, `PaycheckFormData`)
- Modify: `src/lib/services/paycheck.service.ts:31-76`
- Test: `src/tests/paycheck.service.test.ts` (new)

**Interfaces:**
- Consumes: from Task 2 — `getCutoffPeriodForDate(date): CutoffPeriod`; from Task 3 — none.
- Produces: `createPaycheck(supabase, userId, data)` where `data` may include `period_end?: string`; insert always stores a non-null `period_end` (explicit value, or the containing cutoff of `data.date`).
- Produces: `Paycheck.period_end?: string | null`; `PaycheckFormData.period_end?: string`.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/paycheck.service.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPaycheck } from "@/lib/services/paycheck.service";

function makeSupabase(): { supabase: SupabaseClient; insertCalls: Array<Record<string, unknown>> } {
  const insertCalls: Array<Record<string, unknown>> = [];
  const supabase = {
    from: vi.fn(() => ({
      insert: vi.fn((row: Record<string, unknown>) => {
        insertCalls.push(row);
        return { select: vi.fn().mockResolvedValue({ data: { ...row, id: "pc-1" }, error: null }) };
      }),
    })),
  } as unknown as SupabaseClient;
  return { supabase, insertCalls };
}

describe("createPaycheck", () => {
  const USER_ID = "user-123";

  it("persists the explicit period_end when provided", async () => {
    const { supabase, insertCalls } = makeSupabase();
    await createPaycheck(supabase, USER_ID, {
      name: "Sep 13 cutoff",
      amount: 15000,
      date: "2026-09-11",
      allocations: [],
      period_end: "2026-09-13",
    });
    expect(insertCalls[0].period_end).toBe("2026-09-13");
  });

  it("defaults period_end to the cutoff containing the pay date", async () => {
    const { supabase, insertCalls } = makeSupabase();
    await createPaycheck(supabase, USER_ID, {
      name: "Sep 13 cutoff",
      amount: 15000,
      date: "2026-09-11",
      allocations: [],
    });
    expect(insertCalls[0].period_end).toBe("2026-09-13");
  });

  it("maps a 29th pay date to the next month's 13th cutoff", async () => {
    const { supabase, insertCalls } = makeSupabase();
    await createPaycheck(supabase, USER_ID, {
      name: "Dec 29 extra",
      amount: 15000,
      date: "2026-12-29",
      allocations: [],
    });
    expect(insertCalls[0].period_end).toBe("2027-01-13");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/tests/paycheck.service.test.ts`
Expected: FAIL — `createPaycheck` signature does not accept `period_end`.

- [ ] **Step 3: Extend types**

In `src/lib/types/index.ts`:

```ts
export interface Paycheck {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  date: string;
  notes: string | null;
  period_end?: string | null;
  created_at: string;
  updated_at: string;
  allocations?: PaycheckAllocation[];
}
```

In the same file, extend `PaycheckFormData` (end of block):

```ts
export type PaycheckFormData = {
  name: string;
  amount: number;
  date: string;
  notes?: string;
  period_end?: string;
  allocations: Array<{
    category_id?: string;
    label: string;
    amount: number;
  }>;
};
```

> Verify the exact current shape of `PaycheckFormData` before editing (it is at `src/lib/types/index.ts:183` and may already include `allocations` — layer the `period_end?: string;` line into whichever declaration exists).

- [ ] **Step 4: Implement**

In `src/lib/services/paycheck.service.ts`, extend the import (line 3) area:

```ts
import { parseISO } from "date-fns";
import { toISODateString } from "@/lib/utils/date";
import { getCutoffPeriodForDate } from "@/lib/utils/pay-period";
```

Update the `createPaycheck` signature and insert (lines 31–56):

```ts
export async function createPaycheck(
  supabase: SupabaseClient,
  userId: string,
  data: {
    name: string;
    amount: number;
    date: string;
    notes?: string;
    period_end?: string;
    allocations: Array<{
      category_id?: string;
      label: string;
      amount: number;
    }>;
  }
): Promise<Paycheck> {
  const { data: paycheck, error: pcError } = await supabase
    .from("paychecks")
    .insert({
      user_id: userId,
      name: data.name,
      amount: data.amount,
      date: data.date,
      notes: data.notes || null,
      period_end:
        data.period_end || toISODateString(getCutoffPeriodForDate(parseISO(data.date)).periodEnd),
    })
    .select()
    .single();

  if (pcError) throw pcError;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/tests/paycheck.service.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Regression + typecheck + commit**

Run: `npx vitest run src/tests/financial.service.test.ts` and `npx tsc --noEmit`
Expected: existing financial tests PASS; tsc clean.

```bash
git add src/lib/types/index.ts src/lib/services/paycheck.service.ts src/tests/paycheck.service.test.ts
git commit -m "feat: persist paychecks.period_end with engine-derived default"
```

---

### Task 5: Wire `period_end` through the server action + validator

**Files:**
- Modify: `src/lib/utils/validators.ts:43-49` (paycheckSchema)
- Modify: `src/app/(dashboard)/income/actions.ts:103-128` (addPaycheck)

**Interfaces:**
- Consumes: Task 4 — `createPaycheck(supabase, userId, { ..., period_end?: string })`.
- Produces: `addPaycheck(formData)` accepts optional `period_end` and passes it to `createPaycheck`; `paycheckSchema` validates optional `period_end` as ISO-ish string.

- [ ] **Step 1: Extend the validator**

In `src/lib/utils/validators.ts` (paycheckSchema):

```ts
export const paycheckSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  date: z.string().min(1, "Date is required"),
  notes: z.string().max(500).optional().or(z.literal("")),
  period_end: z.string().optional().or(z.literal("")),
  allocations: z.array(allocationSchema),
});
```

- [ ] **Step 2: Pass it through the action**

In `src/app/(dashboard)/income/actions.ts`, `addPaycheck` already passes `parsed.data` to `createPaycheck` — confirm `parsed.data` now includes `period_end` (schema includes it) and the call type-checks. No additional field mapping is needed because `createPaycheck` accepts `period_end?: string`. If `tsc` complains about an excess property, destructure explicitly:

```ts
const { period_end, ...rest } = parsed.data;
await createPaycheck(supabase, user.id, { ...rest, period_end: period_end || undefined });
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit`
Expected: clean.

```bash
git add src/lib/utils/validators.ts "src/app/(dashboard)/income/actions.ts"
git commit -m "feat: validate and pass paychecks.period_end in server action"
```

---

### Task 6: Lean-cutoff notification in the drawer

**Files:**
- Modify: `src/lib/services/notification.service.ts`

**Interfaces:**
- Consumes: Task 3 — `getLeanStatus(supabase, userId): Promise<LeanStatus>`, `LeanStatus`; existing `formatDate` from `@/lib/utils/date`.
- Produces: a new `NotificationItem` of type `warning` with id `lean-cutoff-<periodEnd>` when `phase === "lean"`. Never emitted for `insufficient`/`normal`.

- [ ] **Step 1: Add the import and the concurrent check**

In `src/lib/services/notification.service.ts`, add to the imports (line 7 area):

```ts
import { formatDate } from "@/lib/utils/date";
import { getLeanStatus } from "./pay-period.service";
```

Add `leanStatus` to the `Promise.all` (lines 30–36), keeping the array shape:

```ts
    getLeanStatus(supabase, userId).catch(() => null),
```

And in the destructure:

```ts
    [budgetStatuses, emergencyStatus, goals, paychecks, reminders, leanStatus] = await Promise.all([
```

- [ ] **Step 2: Append the lean check before the dismissed-filter return**

Insert as block 6 after the custom reminders block (after line 128), before the dismissed-id filter:

```ts
  // 6. Lean cutoff check (pay-period engine; paycheck income only)
  if (leanStatus) {
    if (leanStatus.phase === "lean" && leanStatus.targetPeriodEnd && leanStatus.median > 0) {
      const drop = Math.round((1 - (leanStatus.ratio ?? 0)) * 100);
      list.push({
        id: `lean-cutoff-${leanStatus.targetPeriodEnd}`,
        type: "warning",
        title: "Lean Cutoff Detected",
        message: `You earned ₱${leanStatus.targetIncome.toLocaleString()} for the cutoff ending ${formatDate(leanStatus.targetPeriodEnd, "MMM d")} vs your typical ₱${Math.round(leanStatus.median).toLocaleString()} (${drop}% below). Variable budgets will suggest tightening next cutoff.`,
        date: new Date().toISOString(),
      });
    }
  }
```

- [ ] **Step 3: Typecheck + full tests + commit**

Run: `npx tsc --noEmit` and `npx vitest run`
Expected: clean; all 80+ tests pass.

```bash
git add src/lib/services/notification.service.ts
git commit -m "feat: surface lean-cutoff warnings in the notification drawer"
```

---

### Task 7: Paycheck form cutoff pre-fill + override

**Files:**
- Modify: `src/components/forms/paycheck-form.tsx`

**Interfaces:**
- Consumes: Task 2 — `estimatePeriodEndForPayout`, `getCutoffPeriodForDate`, `CUTOFF_ANCHOR_DAYS`; Task 5 — `addPaycheck` accepts optional `period_end`.
- Produces: `paycheckData.period_end` (ISO string) always set; on Submit, `period_end: cutoff` in payload.

- [ ] **Step 1: Add cutoff state + computation**

In `src/components/forms/paycheck-form.tsx`:

- Add imports (line 14 area):

```ts
import { CUTOFF_ANCHOR_DAYS, estimatePeriodEndForPayout, getCutoffPeriodForDate } from "@/lib/utils/pay-period";
```

- Add state (lines 24–26), replacing the uncontrolled date input with controlled state:

```ts
  const [payDate, setPayDate] = useState<string>(toISODateString(new Date()));
  const [overridePeriodEnd, setOverridePeriodEnd] = useState<string | null>(null);
```

- Derive the effective cutoff and the worked-range label, before `handleSubmit`:

```ts
  const inferredPeriodEnd = toISODateString(estimatePeriodEndForPayout(parseISO(payDate)));
  const cutoff = overridePeriodEnd ?? inferredPeriodEnd;
  const cutoffDate = parseISO(cutoff);
  const periodRange = getCutoffPeriodForDate(cutoffDate);
  const cutoffOptions = CUTOFF_ANCHOR_DAYS.map((d) =>
    toISODateString(new Date(cutoffDate.getFullYear(), cutoffDate.getMonth(), d))
  );
```

- In `handleSubmit`, add to `paycheckData`:

```ts
      period_end: cutoff,
```

- Add `parseISO` to the date-fns import. The file currently imports only `toISODateString` from `@/lib/utils/date`; add `import { parseISO } from "date-fns";` on its own line above it.

- [ ] **Step 2: Render the cutoff control**

Replace the Date Received block (lines 87–96) with:

```tsx
          <div className="space-y-2">
            <Label htmlFor="date">Date Received</Label>
            <Input
              id="date"
              name="date"
              type="date"
              value={payDate}
              onChange={(e) => {
                setPayDate(e.target.value);
                setOverridePeriodEnd(null);
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cutoff">Cutoff</Label>
            <select
              id="cutoff"
              name="cutoff"
              value={cutoff}
              onChange={(e) => setOverridePeriodEnd(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none"
            >
              {cutoffOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {formatDate(opt, "MMM d, yyyy")}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Work period {formatDate(periodRange.periodStart, "MMM d")} – {formatDate(periodRange.periodEnd, "MMM d")}
            </p>
          </div>
```

- Add `formatDate` to the `@/lib/utils/date` import.

- [ ] **Step 3: Typecheck + build check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/forms/paycheck-form.tsx
git commit -m "feat: pre-fill and override cutoff in paycheck form"
```

---

### Task 8: Income page lean status chip

**Files:**
- Create: `src/app/(dashboard)/income/lean-status-chip.tsx`
- Modify: `src/app/(dashboard)/income/page.tsx`
- Modify: `src/app/(dashboard)/income/income-page-client.tsx`

**Interfaces:**
- Consumes: Task 3 — `cachedGetLeanStatus(supabase, userId)`, `LeanStatus`; existing `Badge`, `CurrencyDisplay`, `EmptyState` components.
- Produces: `income/page.tsx` passes `leanStatus: LeanStatus` to `IncomePageClient`; the `paychecks` tab renders `<LeanStatusChip status={leanStatus} />` above `<PaycheckPlanner>`.

- [ ] **Step 1: Create the chip component**

Create `src/app/(dashboard)/income/lean-status-chip.tsx`:

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatDate } from "@/lib/utils/date";
import type { LeanStatus } from "@/lib/types";

export function LeanStatusChip({ status }: { status: LeanStatus }) {
  if (status.phase === "insufficient") {
    return (
      <Badge
        variant="outline"
        title={`Lean alerts activate after ~6 logged cutoffs. You have ${status.periodsUsed}. Income basis is paycheck entries only.`}
      >
        Reading your cutoffs… lean alerts need ~3 pay periods
      </Badge>
    );
  }

  const { targetPeriodEnd, targetIncome, median, ratio } = status;
  const drop = ratio != null && ratio < 1 ? Math.round((1 - ratio) * 100) : 0;

  if (status.phase === "lean") {
    return (
      <Badge
        className="bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300"
        title={`Paycheck income only. Based on ${status.periodsUsed} logged cutoffs. Ratio vs median: ${Math.round((ratio ?? 0) * 100)}%.`}
      >
        Lean cutoff · <CurrencyDisplay amount={targetIncome} /> vs typical{" "}
        <CurrencyDisplay amount={Math.round(median)} /> (−{drop}%)
      </Badge>
    );
  }

  return (
    <Badge
      variant="income"
      title={`Paycheck income only. Based on ${status.periodsUsed} logged cutoffs.`}
    >
      On track · <CurrencyDisplay amount={targetIncome} /> vs typical{" "}
      <CurrencyDisplay amount={Math.round(median)} />
    </Badge>
  );
}
```

> If `Badge` has no `variant="outline"`, use `variant="secondary"` instead. Check `src/components/ui/badge.tsx` for defined variants.

- [ ] **Step 2: Wire the server page**

In `src/app/(dashboard)/income/page.tsx`, add the import (line 4 area):

```ts
import { cachedGetLeanStatus as getLeanStatus } from "@/lib/cache/shared-queries";
```

Add to the `Promise.all` (lines 14–19):

```ts
    getLeanStatus(supabase, user.id),
```

And pass to the client (lines 24–32), adding `leanStatus` to the props object:

```ts
      leanStatus={...}
```

(The `Promise.all` result is already destructured positionally as `[entries, sources, paychecks, categories]` — extend the destructure to `[entries, sources, paychecks, categories, leanStatus]`.)

- [ ] **Step 3: Render the chip in the paychecks tab**

In `src/app/(dashboard)/income/income-page-client.tsx`:

- Import the component and type (line 18 area):

```ts
import { LeanStatusChip } from "./lean-status-chip";
import type { IncomeEntry, IncomeSource, Paycheck, ExpenseCategory, LeanStatus } from "@/lib/types";
```

- Add to the props interface (lines 20–28) and destructure (lines 30–36):

```ts
interface IncomePageClientProps {
  initialEntries: IncomeEntry[];
  sources: IncomeSource[];
  paychecks: Paycheck[];
  categories: ExpenseCategory[];
  leanStatus: LeanStatus;
  totalThisMonth: number;
  currentMonth: number;
  currentYear: number;
}
```

- Render at the top of the paychecks `TabsContent` (around line 244):

```tsx
        <TabsContent value="paychecks" className="space-y-6">
          <LeanStatusChip status={leanStatus} />
          <PaycheckPlanner
            initialPaychecks={paychecks}
            categories={categories}
          />
        </TabsContent>
```

- [ ] **Step 4: Typecheck + full test + build**

Run: `npx tsc --noEmit`, `npx vitest run`, then `npm run build`
Expected: all clean.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/income/lean-status-chip.tsx src/app/\(dashboard\)/income/page.tsx src/app/\(dashboard\)/income/income-page-client.tsx
git commit -m "feat: show lean-cutoff status chip on the income page"
```

---

### Task 9: Apply migration + live verification + gates + deploy

**Files:**
- Apply: `supabase/migrations/006_pay_period_engine.sql` to the Supabase cloud database (project `jaaeeyeyidvekzdssqfv` — apply via the Supabase SQL editor dashboard; the repo has no CLI runbook for migrations).
- No new code files.

- [ ] **Step 1: Apply the migration**

Paste the full SQL from `supabase/migrations/006_pay_period_engine.sql` into the Supabase SQL editor for the project and run it. Verify with:

```sql
SELECT count(*) AS total,
       count(period_end) AS with_period_end
FROM public.paychecks;
```

Expect `total = with_period_end` (any legacy unmatchable rows yield a small, explainable shortfall).

- [ ] **Step 2: Start dev server**

Run: `npm run dev` (wait for ready; app served on `http://localhost:3000`).

- [ ] **Step 3: Live-verify chip states with the QA account**

Use the headless-Chrome CDP scripts in `C:\Users\RITZ\AppData\Local\Temp\opencode` against the authenticated tab (`ws://127.0.0.1:9228`; re-discover via `http://127.0.0.1:9228/json` if the tab id changed). Log in as `qa.dashboard.latency@example.com` / `Latency!Probe2026` if the tab is not already authenticated.

Navigate to `/income`. Confirm the `paychecks` tab shows the **insufficient** chip ("Reading your cutoffs…", periods 0).

Then add paychecks via the form (allocation editor optional) crossing **≥7 distinct cutoffs**, ending the oldest period before 2026-05-28 and the most recent completed at **2026-08-28 with a below-median amount**, with all older periods at a stable median:

| period_end | pay date (payout) | amount |
|---|---|---|
| 2026-05-13 | 2026-05-13 (Wed) | 10000 |
| 2026-05-28 | 2026-05-28 (Thu) | 10000 |
| 2026-06-13 | 2026-06-13 (Sat) → 06-12 | 10000 |
| 2026-06-28 | 2026-06-28 (Sun) → 06-26 | 10000 |
| 2026-07-13 | 2026-07-13 (Mon) | 10000 |
| 2026-07-28 | 2026-07-28 (Tue) | 10000 |
| 2026-08-13 | 2026-08-13 (Thu) | 10000 |
| 2026-08-28 | 2026-08-28 (Fri) | 6000 |

Verify: on each save the Cutoff select pre-fills the correct anchor (assert the form's cutoff label matches the row above); after all rows, the chip transitions **insufficient → lean** (rose, "−40%"); the notification drawer gains **one** "Lean Cutoff Detected" item when opened from the dashboard (id `lean-cutoff-2026-08-28`), and does NOT duplicate across reloads.

- [ ] **Step 4: Verify the in-flight guard live**

Add one more paycheck: `period_end 2026-09-13`, pay date `2026-09-11`, amount `10000`. Revisit `/income`: the chip must **still reference 2026-08-28** (the in-flight September period is never the target). Payday 09-11 is in the future at 2026-09-08.

- [ ] **Step 5: Clean up test data (optional but tidy)**

Delete the 9 QA paychecks via the planner UI so the account returns to its pre-verification state for future feature work.

- [ ] **Step 6: Full gates**

Run: `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`
Expected: all pass.

- [ ] **Step 7: Commit + deploy**

```bash
git add -A
git status
git commit -m "feat(verify): V1 pay-period lean detection live-verified"
```

Push to `origin/master`, then deploy from the repo root: `vercel deploy --target production --yes`.
Open `https://money-map-ph.vercel.app/income` and confirm the chip renders (insufficient state for real users without paycheck history) and the app loads with no console errors.

- [ ] **Step 8: Report**

Report to the user: chip state confirmed, lean notification count, in-flight guard behavior, migration row counts, test totals, deploy URL. Surface the `qa.dashboard.latency@example.com` account state (whether test paychecks were cleaned up).