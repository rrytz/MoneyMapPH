# Safe-to-Spend Cutoff Model (V2+V4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give users a pay-period-scoped "safe to spend" figure (core income + incentives logged − spent this cutoff) surfaced on the dashboard and income page, with income sources classifiable as core or incentive.

**Architecture:** Approach A compute-only overlay — a pure engine helper (`getPeriodProgress`) plus a server service (`getSafeToSpend`) with a period-end-keyed cache wrapper feeding two presentational components (dashboard card, income-page card), one migration adding `income_sources.type`, and an opt-in type selector in the Settings income-source modal. The calendar-month budget/health model and lean detection are untouched.

**Tech Stack:** TypeScript 5, Next.js 16.2.12 (Turbopack), Supabase + Postgres (cloud), zod 4, date-fns 4, lucide-react, Vitest 5 (mocked supabase query builders), Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-09-13-safe-to-spend-cutoff-model-design.md`

## Global Constraints

- **Core income = paychecks only.** Core-type manual `income_entries` never count toward safe-to-spend. Incentive income counts **only when logged** in the period (two-sided rule).
- "Current cutoff period" = `getCutoffPeriodForDate(now)` — always the in-progress period. Bucketing window `[periodStart, periodEnd]` is **inclusive**.
- Paycheck-to-period assignment: `period_end` when set; `date`-range fallback when `period_end IS NULL`; a paycheck with a `period_end` pointing at another period is never counted in the current period.
- New sources default to `"core"` (DB default + UI default). No name-matching, no tagging.
- `hasPaychecks = false` (never logged a paycheck) → dashboards/cards show guidance, never a misleading number.
- Migration is applied to the cloud DB by the controller during Task 8 (executors never apply migrations; no DB creds).
- Gate commands before every commit: `npx tsc --noEmit`, `npm test`, `npm run lint`. Full `npm run build` at Task 8.
- Test suite lives in `src/tests/*.test.ts`, Vitest, mocked supabase via query-builder stubs (see Task 3's mock pattern).

---

### Task 1: Income source type — migration file, types, validators, service, actions

**Files:**
- Create: `supabase/migrations/007_income_source_type.sql`
- Modify: `src/lib/types/index.ts` (add `IncomeSourceType`, extend `IncomeSource`)
- Modify: `src/lib/utils/validators.ts` (extend `sourceSchema`)
- Modify: `src/lib/services/category.service.ts` (`createIncomeSource`, `updateIncomeSource`)
- Modify: `src/app/(dashboard)/settings/actions.ts` (`addIncomeSourceSetting`, `editIncomeSourceSetting`)
- Test: `src/tests/source-schema.test.ts`

**Interfaces:**
- Produces: `IncomeSourceType = "core" | "incentive"`; `IncomeSource.type: IncomeSourceType`; `sourceSchema` parses `{ name, type?: "core"|"incentive" }` defaulting to `"core"`; `createIncomeSource(supabase, userId, { name, type? })`; `updateIncomeSource(supabase, userId, sourceId, { name, type? })`; `addIncomeSourceSetting({ name, type? })`; `editIncomeSourceSetting(sourceId, { name, type? })`.
- Consumes: nothing new.

- [ ] **Step 1: Create the migration file**

`supabase/migrations/007_income_source_type.sql`:

```sql
-- ============================================================
-- INCOME SOURCE TYPE
-- Classifies income sources as core (salary) or incentive
-- (bonus/OT/commission). Defaults everything to 'core' so the
-- core/incentive split is an explicit, opt-in signal (V2+V4 safe-to-spend).
-- ============================================================

ALTER TABLE public.income_sources
  ADD COLUMN type TEXT NOT NULL DEFAULT 'core'
  CHECK (type IN ('core', 'incentive'));
```

- [ ] **Step 2: Add `IncomeSourceType` and extend `IncomeSource`**

In `src/lib/types/index.ts`, extend the existing `IncomeSource` interface and add the union type above it:

```ts
export type IncomeSourceType = "core" | "incentive";

export interface IncomeSource {
  id: string;
  user_id: string;
  name: string;
  type: IncomeSourceType;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
```

(Requires a `read` of the current `IncomeSource` block to replace — it is at the top of `src/lib/types/index.ts`.)

- [ ] **Step 3: Extend `sourceSchema`**

In `src/lib/utils/validators.ts`, replace the existing `sourceSchema`:

```ts
export const sourceSchema = z.object({
  name: z.string().min(1, "Source name is required").max(50, "Name must be 50 characters or less"),
  type: z.enum(["core", "incentive"]).default("core"),
});
```

- [ ] **Step 4: Write the failing validator test**

Create `src/tests/source-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sourceSchema } from "@/lib/utils/validators";

describe("sourceSchema", () => {
  it("defaults type to core", () => {
    const parsed = sourceSchema.parse({ name: "Salary" });
    expect(parsed.type).toBe("core");
  });

  it("accepts an explicit incentive type", () => {
    const parsed = sourceSchema.parse({ name: "Commission", type: "incentive" });
    expect(parsed.type).toBe("incentive");
  });

  it("rejects invalid source types", () => {
    expect(() => sourceSchema.parse({ name: "Bonus", type: "bonus" })).toThrow();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run src/tests/source-schema.test.ts`
Expected: FAIL — `sourceSchema` currently has no `type` field, so `parsed.type` is `undefined`.

- [ ] **Step 6: Compile the sourceSchema change and re-run**

Run: `npx vitest run src/tests/source-schema.test.ts`
Expected: PASS (3/3).

- [ ] **Step 7: Update `category.service.ts` to accept `type`**

In `src/lib/services/category.service.ts`:
- Change `createIncomeSource`'s `data` type to `{ name: string; type?: IncomeSourceType }` and add `type: data.type ?? "core"` to the insert object.
- Change `updateIncomeSource`'s `data` type to `{ name: string; type?: IncomeSourceType }` (the `.update(data)` call is unchanged).
- Add `IncomeSourceType` to the `@/lib/types` import.

```ts
export async function createIncomeSource(
  supabase: SupabaseClient,
  userId: string,
  data: { name: string; type?: IncomeSourceType }
): Promise<IncomeSource> {
  const { data: maxOrder } = await supabase
    .from("income_sources")
    .select("sort_order")
    .eq("user_id", userId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: source, error } = await supabase
    .from("income_sources")
    .insert({
      user_id: userId,
      name: data.name,
      type: data.type ?? "core",
      sort_order: (maxOrder?.sort_order || 0) + 1,
    })
    .select()
    .single();

  if (error) throw error;
  return source as IncomeSource;
}

export async function updateIncomeSource(
  supabase: SupabaseClient,
  userId: string,
  sourceId: string,
  data: { name: string; type?: IncomeSourceType }
): Promise<IncomeSource> {
  const { data: source, error } = await supabase
    .from("income_sources")
    .update(data)
    .eq("id", sourceId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return source as IncomeSource;
}
```

- [ ] **Step 8: Update `settings/actions.ts` to pass `type`**

In `src/app/(dashboard)/settings/actions.ts`, change both handler signatures and payloads:

```ts
export async function addIncomeSourceSetting(data: { name: string; type?: "core" | "incentive" }) {
  // ... unchanged ...
  const source = await createIncomeSource(supabase, user.id, data);
  // ... unchanged ...
}

export async function editIncomeSourceSetting(sourceId: string, data: { name: string; type?: "core" | "incentive" }) {
  // ... unchanged ...
  const source = await updateIncomeSource(supabase, user.id, sourceId, data);
  // ... unchanged ...
}
```

(`sourceSchema.safeParse(data)` now passes `type` through untouched. `revalidatePath` calls already cover `/settings`, `/dashboard`, `/income`.)

- [ ] **Step 9: Run all tests, typecheck, lint**

Run: `npx vitest run`
Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: all pass. (The `IncomeSource.type` field is required, so `npx tsc --noEmit` will surface any object literal missing it — there are none today.)

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/007_income_source_type.sql src/lib/types/index.ts src/lib/utils/validators.ts src/lib/services/category.service.ts src/app/(dashboard)/settings/actions.ts src/tests/source-schema.test.ts
git commit -m "feat: add income source type (core/incentive) with migration, validator, and actions"
```

---

### Task 2: Period progress helper (pure engine)

**Files:**
- Modify: `src/lib/utils/pay-period.ts`
- Test: `src/tests/pay-period.test.ts`

**Interfaces:**
- Produces: `PeriodProgress { daysTotal, daysElapsed, daysRemaining, fractionElapsed }` and `getPeriodProgress(periodEnd: Date, now?: Date): PeriodProgress` (clamped to `[0, daysTotal]`; `fractionElapsed` in `[0,1]`; `daysTotal` counts both ends of the inclusive date range).
- Consumes: `getPeriodRange` (already exported).

- [ ] **Step 1: Write the failing tests**

Append to `src/tests/pay-period.test.ts`:

```ts
import { getPeriodProgress } from "@/lib/utils/pay-period";

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/pay-period.test.ts`
Expected: FAIL — `getPeriodProgress` is not exported.

- [ ] **Step 3: Implement `getPeriodProgress`**

Append to `src/lib/utils/pay-period.ts`:

```ts
const DAY_MS = 86_400_000;

export interface PeriodProgress {
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  fractionElapsed: number;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getPeriodProgress(periodEnd: Date, now: Date = new Date()): PeriodProgress {
  const { periodStart } = getPeriodRange(periodEnd);
  const daysTotal =
    Math.round((startOfDay(periodEnd).getTime() - startOfDay(periodStart).getTime()) / DAY_MS) + 1;
  const elapsed = Math.round((startOfDay(now).getTime() - startOfDay(periodStart).getTime()) / DAY_MS) + 1;
  const daysElapsed = Math.min(Math.max(elapsed, 0), daysTotal);
  const daysRemaining = Math.max(daysTotal - daysElapsed, 0);
  const fractionElapsed = daysTotal > 0 ? daysElapsed / daysTotal : 0;
  return { daysTotal, daysElapsed, daysRemaining, fractionElapsed };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/pay-period.test.ts`
Expected: PASS (existing pay-period tests + 4 new progress tests).

- [ ] **Step 5: Typecheck, lint**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/pay-period.ts src/tests/pay-period.test.ts
git commit -m "feat: add pure period-progress helper for safe-to-spend"
```

---

### Task 3: `getSafeToSpend` service + `SafeToSpendStatus` type + cached wrapper

**Files:**
- Create: `src/lib/services/safe-to-spend.service.ts`
- Modify: `src/lib/types/index.ts` (add `SafeToSpendStatus`)
- Modify: `src/lib/cache/shared-queries.ts` (add `cachedGetSafeToSpend`)
- Test: `src/tests/safe-to-spend.service.test.ts`

**Interfaces:**
- Consumes: `getCutoffPeriodForDate` + `getPeriodProgress` from `@/lib/utils/pay-period`; `toISODateString` from `@/lib/utils/date`; `unstable_cache` from `next/cache`; `REVALIDATE_SECONDS` from `shared-queries.ts`.
- Produces:
  - `SafeToSpendStatus { periodStart, periodEnd, payoutDate, coreIncome, incentiveIncomeLogged, spentThisPeriod, safeToSpend, hasPaychecks, daysTotal, daysElapsed, daysRemaining, fractionElapsed }` (all `string`/`number`/`boolean` as in the spec §6).
  - `getSafeToSpend(supabase: SupabaseClient, userId: string, now?: Date): Promise<SafeToSpendStatus>`
  - `cachedGetSafeToSpend(supabase: SupabaseClient, userId: string, now?: Date): Promise<SafeToSpendStatus>` — cache key `["safe-to-spend", userId, periodEndISO]`.

- [ ] **Step 1: Add the `SafeToSpendStatus` type**

Append to `src/lib/types/index.ts`:

```ts
export interface SafeToSpendStatus {
  periodStart: string;
  periodEnd: string;
  payoutDate: string;
  coreIncome: number;
  incentiveIncomeLogged: number;
  spentThisPeriod: number;
  safeToSpend: number;
  hasPaychecks: boolean;
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  fractionElapsed: number;
}
```

- [ ] **Step 2: Write the failing service tests**

Create `src/tests/safe-to-spend.service.test.ts`:

```ts
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
        paychecks: [{ id: "p1", period_end: "2026-09-13", date: "2026-09-11", amount: 15000 }],
        expenses: [
          { id: "e1", date: "2026-09-05", amount: 5000 },
          { id: "e2", date: "2026-09-14", amount: 999 }, // outside period
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
        paychecks: [{ id: "p1", period_end: "2026-09-13", date: "2026-09-11", amount: 15000 }],
        income_sources: [
          { id: "s-core", type: "core" },
          { id: "s-inc", type: "incentive" },
        ],
        income_entries: [
          { id: "i1", source_id: "s-inc", date: "2026-09-06", amount: 2000 },
          { id: "i2", source_id: "s-core", date: "2026-09-06", amount: 9999 },
        ],
        expenses: [{ id: "e1", date: "2026-09-06", amount: 3000 }],
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
        paychecks: [{ id: "p1", period_end: "2026-09-13", date: "2026-09-11", amount: 8000 }],
        expenses: [{ id: "e1", date: "2026-09-01", amount: 10000 }],
      })
    );
    const s = await getSafeToSpend(supabase, USER_ID, NOW);
    expect(s.safeToSpend).toBe(-2000);
  });

  it("respects period_end override, falls back to date for NULL period_end, and ignores foreign periods", async () => {
    const supabase = makeSupabase(
      tables({
        paychecks: [
          { id: "p1", period_end: "2026-09-13", date: "2026-08-01", amount: 9000 }, // override: in period
          { id: "p2", period_end: null, date: "2026-09-02", amount: 7000 }, // null fallback: in period
          { id: "p3", period_end: "2026-08-28", date: "2026-09-02", amount: 3000 }, // other period: ignored
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
          { id: "p1", period_end: "2026-09-13", date: "2026-09-11", amount: 15000 }, // prior period
          { id: "p2", period_end: "2026-09-28", date: "2026-09-15", amount: 12000 },
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
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run src/tests/safe-to-spend.service.test.ts`
Expected: FAIL — `safe-to-spend.service` does not exist.

- [ ] **Step 4: Implement the service**

Create `src/lib/services/safe-to-spend.service.ts`:

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import { getCutoffPeriodForDate, getPeriodProgress } from "@/lib/utils/pay-period";
import { toISODateString } from "@/lib/utils/date";
import type { SafeToSpendStatus } from "@/lib/types";

export async function getSafeToSpend(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<SafeToSpendStatus> {
  const current = getCutoffPeriodForDate(now);
  const periodStartISO = toISODateString(current.periodStart);
  const periodEndISO = toISODateString(current.periodEnd);

  const [pcRes, srcRes, enRes, exRes] = await Promise.all([
    supabase
      .from("paychecks")
      .select("id, period_end, date, amount")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(50),
    supabase.from("income_sources").select("id, type").eq("user_id", userId),
    supabase
      .from("income_entries")
      .select("id, source_id, amount, date")
      .eq("user_id", userId)
      .gte("date", periodStartISO)
      .lte("date", periodEndISO),
    supabase
      .from("expenses")
      .select("id, amount, date")
      .eq("user_id", userId)
      .gte("date", periodStartISO)
      .lte("date", periodEndISO),
  ]);

  if (pcRes.error) throw pcRes.error;
  if (srcRes.error) throw srcRes.error;
  if (enRes.error) throw enRes.error;
  if (exRes.error) throw exRes.error;

  const incentiveIds = new Set(
    (srcRes.data || []).filter((s) => s.type === "incentive").map((s) => s.id)
  );

  const coreIncome = (pcRes.data || []).reduce((sum, r) => {
    const inPeriod =
      r.period_end != null
        ? r.period_end === periodEndISO
        : r.date >= periodStartISO && r.date <= periodEndISO;
    return inPeriod ? sum + Number(r.amount) : sum;
  }, 0);

  const incentiveIncomeLogged = (enRes.data || []).reduce(
    (sum, r) => (incentiveIds.has(r.source_id as string) ? sum + Number(r.amount) : sum),
    0
  );

  const spentThisPeriod = (exRes.data || []).reduce((sum, r) => sum + Number(r.amount), 0);

  const progress = getPeriodProgress(current.periodEnd, now);

  return {
    periodStart: periodStartISO,
    periodEnd: periodEndISO,
    payoutDate: toISODateString(current.payoutDate),
    coreIncome,
    incentiveIncomeLogged,
    spentThisPeriod,
    safeToSpend: coreIncome + incentiveIncomeLogged - spentThisPeriod,
    hasPaychecks: (pcRes.data || []).length > 0,
    daysTotal: progress.daysTotal,
    daysElapsed: progress.daysElapsed,
    daysRemaining: progress.daysRemaining,
    fractionElapsed: progress.fractionElapsed,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/tests/safe-to-spend.service.test.ts`
Expected: PASS (all 6 tests). Note: `srcRes.data` rows come untyped from the mock; the `s.type === "incentive"` / `r.source_id` comparisons need no casts because the mock returns `any`-typed `data`.

- [ ] **Step 6: Add `cachedGetSafeToSpend`**

In `src/lib/cache/shared-queries.ts`:
- Add imports: `getSafeToSpend` from `@/lib/services/safe-to-spend.service`; `getCutoffPeriodForDate` from `@/lib/utils/pay-period`; `toISODateString` from `@/lib/utils/date`; add `SafeToSpendStatus` to the `@/lib/types` import list.
- Append the wrapper (keyed by `userId` + `periodEnd` so a cutoff rollover never serves a stale period's numbers):

```ts
export const cachedGetSafeToSpend = (
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<SafeToSpendStatus> => {
  const periodEnd = toISODateString(getCutoffPeriodForDate(now).periodEnd);
  return unstable_cache(
    async () => getSafeToSpend(supabase, userId, now),
    ["safe-to-spend", userId, periodEnd],
    { revalidate: REVALIDATE_SECONDS, tags: [`q:safe-to-spend:${userId}`, "q:financial"] }
  )();
};
```

- [ ] **Step 7: Run all tests, typecheck, lint**

Run: `npx vitest run`
Run: `npx tsc --noEmit`
Run: `npm run lint`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/services/safe-to-spend.service.ts src/lib/types/index.ts src/lib/cache/shared-queries.ts src/tests/safe-to-spend.service.test.ts
git commit -m "feat: add safe-to-spend service, status type, and period-keyed cache wrapper"
```

---

### Task 4: Dashboard Safe-to-Spend card

**Files:**
- Create: `src/components/dashboard/safe-to-spend-card.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `SafeToSpendStatus` (Task 3), `cachedGetSafeToSpend` (Task 3).
- Produces: `<SafeToSpendCard status: SafeToSpendStatus />` — distinct from `KpiCard` (period-scoped subtitle "this cutoff · ends <date>", state accent, "X days left", progress bar, incentive line, empty-state guidance when `hasPaychecks === false`).

- [ ] **Step 1: Write the card component**

Create `src/components/dashboard/safe-to-spend-card.tsx`:

```tsx
"use client";

import { Gauge } from "lucide-react";
import { FintechCard, FintechCardContent } from "@/components/ui/fintech-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { SafeToSpendStatus } from "@/lib/types";

export function SafeToSpendCard({ status }: { status: SafeToSpendStatus }) {
  if (!status.hasPaychecks) {
    return (
      <FintechCard className="relative">
        <FintechCardContent className="p-5 flex flex-col justify-between h-full space-y-4">
          <div className="flex items-center justify-between">
            <div className="p-2.5 rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <Gauge className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Safe to Spend</span>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">—</div>
            <p className="text-[11px] text-muted-foreground">Log your paycheck to unlock safe-to-spend.</p>
          </div>
        </FintechCardContent>
      </FintechCard>
    );
  }

  const received = status.coreIncome + status.incentiveIncomeLogged;
  const state =
    status.safeToSpend <= 0
      ? { color: "text-rose-500", bar: "bg-rose-500", label: "Over this cutoff" }
      : received > 0 && status.safeToSpend / received <= 0.2
        ? { color: "text-amber-500", bar: "bg-amber-500", label: "Nearly out this cutoff" }
        : { color: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", label: "Safe to spend this cutoff" };
  const pct = Math.min(100, Math.round(status.fractionElapsed * 100));

  return (
    <FintechCard className="relative">
      <FintechCardContent className="p-5 flex flex-col justify-between h-full space-y-4">
        <div className="flex items-center justify-between">
          <div className="p-2.5 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Gauge className="h-4.5 w-4.5" />
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-200/50">
            {state.label}
          </span>
        </div>

        <div className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Safe to Spend</span>
          <CurrencyDisplay amount={status.safeToSpend} className={cn("text-2xl sm:text-3xl font-bold tracking-tight tabular-nums", state.color)} />
          <p className="text-[11px] text-muted-foreground">
            this cutoff · ends {formatDate(status.periodEnd, "MMM d")}
          </p>
        </div>

        <div className="space-y-1.5 pt-1 border-t border-border/50 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[11px]">{status.daysRemaining} days left in this cutoff</span>
            <span className="text-muted-foreground text-[11px] tabular-nums">{pct}% elapsed</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className={cn("h-full rounded-full", state.bar)} style={{ width: `${pct}%` }} />
          </div>
          {status.incentiveIncomeLogged > 0 && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
              + <CurrencyDisplay amount={status.incentiveIncomeLogged} /> incentives logged this cutoff
            </p>
          )}
        </div>
      </FintechCardContent>
    </FintechCard>
  );
}
```

- [ ] **Step 2: Wire it into the dashboard page**

In `src/app/(dashboard)/dashboard/page.tsx`:
- Add `cachedGetSafeToSpend` to the `@/lib/cache/shared-queries` import (line 2) with alias `getSafeToSpend`.
- Add `import { SafeToSpendCard } from "@/components/dashboard/safe-to-spend-card";`.
- Add `Gauge` is NOT needed here (it lives in the card).
- Add to the `Promise.all` destructure (as the 9th value) and the array:

```tsx
const [
  summary,
  snapshots,
  categories,
  goals,
  recentIncome,
  recentExpenses,
  budgetStatuses,
  paychecks,
  safeToSpend,
] = await Promise.all([
  // ... existing 8 ...
  getPaychecks(supabase, user.id, month, year),
  getSafeToSpend(supabase, user.id),
]);
```

- In the KPI grid (right column, currently `grid-cols-1 sm:grid-cols-2`), render `SafeToSpendCard` as the first card, before `KpiCard` "Remaining Budget":

```tsx
<div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
  <SafeToSpendCard status={safeToSpend} />
  <KpiCard title="Remaining Budget" ... />
  <KpiCard title="Savings Rate" ... />
</div>
```

(The card is intentionally visually distinct from `KpiCard` — it answers a different question than Remaining Budget: income-based, cutoff-scoped, with period-end and days-left context.)

- [ ] **Step 3: Typecheck, lint, run tests**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/safe-to-spend-card.tsx src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat: add safe-to-spend KPI card with cutoff scope to dashboard"
```

---

### Task 5: Income page "This cutoff" card

**Files:**
- Create: `src/app/(dashboard)/income/period-safe-to-spend-card.tsx`
- Modify: `src/app/(dashboard)/income/page.tsx`
- Modify: `src/app/(dashboard)/income/income-page-client.tsx`

**Interfaces:**
- Consumes: `SafeToSpendStatus`, `cachedGetSafeToSpend` (Task 3).
- Produces: `<PeriodSafeToSpendCard status: SafeToSpendStatus />` — compact, lower-key than the dashboard card, with a period-range header and a 3-row breakdown (Core income / Incentives logged / Spent this cutoff).

- [ ] **Step 1: Write the income-page card**

Create `src/app/(dashboard)/income/period-safe-to-spend-card.tsx`:

```tsx
"use client";

import { CalendarRange } from "lucide-react";
import { FintechCard, FintechCardHeader, FintechCardTitle, FintechCardContent } from "@/components/ui/fintech-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { SafeToSpendStatus } from "@/lib/types";

function BreakdownRow({ label, amount, accent }: { label: string; amount: number; accent?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <CurrencyDisplay amount={amount} className={cn("font-semibold tabular-nums", accent)} />
    </div>
  );
}

export function PeriodSafeToSpendCard({ status }: { status: SafeToSpendStatus }) {
  return (
    <FintechCard>
      <FintechCardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CalendarRange className="h-4 w-4" />
          </div>
          <div>
            <FintechCardTitle>This cutoff</FintechCardTitle>
            <p className="text-xs text-muted-foreground">
              {formatDate(status.periodStart)} – {formatDate(status.periodEnd)}
            </p>
          </div>
        </div>
      </FintechCardHeader>
      <FintechCardContent className="space-y-3">
        {!status.hasPaychecks ? (
          <p className="text-xs text-muted-foreground">
            Log your paycheck to unlock safe-to-spend. Core income counts paychecks only.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted-foreground">Safe to spend</span>
              <CurrencyDisplay
                amount={status.safeToSpend}
                className={cn(
                  "text-2xl font-bold tracking-tight tabular-nums",
                  status.safeToSpend <= 0 ? "text-rose-500" : "text-emerald-600 dark:text-emerald-400"
                )}
              />
            </div>
            <div className="space-y-1.5 pt-2 border-t border-border/60">
              <BreakdownRow label="Core income" amount={status.coreIncome} />
              <BreakdownRow label="Incentives logged" amount={status.incentiveIncomeLogged} accent="text-emerald-600 dark:text-emerald-400" />
              <BreakdownRow label="Spent this cutoff" amount={status.spentThisPeriod} accent="text-rose-500" />
            </div>
            <p className="text-[11px] text-muted-foreground">{status.daysRemaining} days left in this cutoff</p>
          </>
        )}
      </FintechCardContent>
    </FintechCard>
  );
}
```

- [ ] **Step 2: Wire into the income page server component**

In `src/app/(dashboard)/income/page.tsx`:
- Add `cachedGetSafeToSpend as getSafeToSpend` to the shared-queries import on line 4.
- Destructure a 6th value and add to the `Promise.all`:

```tsx
const [{ data: entries }, sources, paychecks, categories, leanStatus, safeToSpend] = await Promise.all([
  getIncomeEntries(supabase, user.id, { month, year, limit: 20 }),
  getIncomeSources(supabase, user.id),
  getPaychecks(supabase, user.id, month, year),
  getExpenseCategories(supabase, user.id),
  getLeanStatus(supabase, user.id),
  getSafeToSpend(supabase, user.id),
]);
```

- Pass through to the client: add `safeToSpend={safeToSpend}` to `<IncomePageClient ...>`.

- [ ] **Step 3: Add the prop and render in the client**

In `src/app/(dashboard)/income/income-page-client.tsx`:
- Import `PeriodSafeToSpendCard` and add `SafeToSpendStatus` to the `@/lib/types` import.
- Add to the props interface: `safeToSpend: SafeToSpendStatus;`
- Add to the destructure: `safeToSpend,`
- In the `TabsContent value="paychecks"` block, render between `LeanStatusChip` and `PaycheckPlanner`:

```tsx
<TabsContent value="paychecks" className="space-y-6">
  <LeanStatusChip status={leanStatus} />
  <PeriodSafeToSpendCard status={safeToSpend} />
  <PaycheckPlanner initialPaychecks={paychecks} categories={categories} />
</TabsContent>
```

- [ ] **Step 4: Typecheck, lint, run tests**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Run: `npx vitest run`
Expected: all pass. (The client already destructures only the props it uses; `currentMonth`/`currentYear` remain unused as before — do not add `safeToSpend` handling to those.)

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/income/period-safe-to-spend-card.tsx src/app/(dashboard)/income/page.tsx src/app/(dashboard)/income/income-page-client.tsx
git commit -m "feat: show this-cutoff safe-to-spend card on income page"
```

---

### Task 6: Settings income-source type selector

**Files:**
- Modify: `src/app/(dashboard)/settings/settings-client.tsx`

**Interfaces:**
- Consumes: `IncomeSource.type`, `addIncomeSourceSetting({ name, type })`, `editIncomeSourceSetting(id, { name, type })` (Task 1).
- Produces: source modal gains a type `Select` (defaulting to `"core"`, prefilled on edit) and source list shows an "Incentive" badge for incentive sources.

- [ ] **Step 1: Add type state and wire the modal**

In `src/app/(dashboard)/settings/settings-client.tsx`:
- Import `IncomeSourceType` from `@/lib/types` (add to the existing type import).
- Add state next to `sourceName`:

```tsx
const [sourceType, setSourceType] = useState<IncomeSourceType>("core");
```

- In `openNewSourceModal`, reset it:

```tsx
function openNewSourceModal() {
  setSelectedSource(null);
  setSourceName("");
  setSourceType("core");
  setSourceModalOpen(true);
}
```

- In `openEditSourceModal`, prefill it:

```tsx
function openEditSourceModal(src: IncomeSource) {
  setSelectedSource(src);
  setSourceName(src.name);
  setSourceType(src.type ?? "core");
  setSourceModalOpen(true);
}
```

- In `handleSourceSubmit`, pass it through (both branches):

```tsx
const res = selectedSource
  ? await editIncomeSourceSetting(selectedSource.id, { name: sourceName, type: sourceType })
  : await addIncomeSourceSetting({ name: sourceName, type: sourceType });
```

- [ ] **Step 2: Add the type control to the source dialog**

In the source `Dialog` form (`src-name` input block ends at line ~435), insert between the name field and `DialogFooter`:

```tsx
<div className="space-y-1.5">
  <Label htmlFor="src-type">Source Type</Label>
  <Select value={sourceType} onValueChange={(v) => setSourceType((v || "core") as IncomeSourceType)}>
    <SelectTrigger id="src-type">
      <SelectValue placeholder="Select source type" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="core">Core income (regular salary)</SelectItem>
      <SelectItem value="incentive">Incentive (bonus, OT, commission)</SelectItem>
    </SelectContent>
  </Select>
  <p className="text-[11px] text-muted-foreground">
    Core income is paychecks only. Incentives count toward safe-to-spend only when you log them.
  </p>
</div>
```

(`Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` are already imported.)

- [ ] **Step 3: Show the badge in the source list**

In the sources list row (next to the `src.name` span), add below the default-source badge block:

```tsx
{src.type === "incentive" && (
  <span className="inline-flex px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/40 text-[9px] font-bold text-violet-700 dark:text-violet-300">
    Incentive
  </span>
)}
```

- [ ] **Step 4: Typecheck, lint, run tests**

Run: `npx tsc --noEmit`
Run: `npm run lint`
Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/settings/settings-client.tsx
git commit -m "feat: add income source type selector to settings"
```

---

### Task 7: Full gates

- [ ] **Step 1: Run all verification commands**

Run: `npx tsc --noEmit`
Run: `npm test`
Run: `npm run lint`
Run: `npm run build`
Expected: typecheck clean, all tests pass, lint clean, production build succeeds.

- [ ] **Step 2: Commit any stragglers (if the gates surfaced fixes)**

```bash
git add -A
git commit -m "chore: clean up safe-to-spend gates"
```

(Only run this if Step 1 produced changes. Otherwise skip.)

---

### Task 8: Live verification — apply migration, seed QA, verify UI + rollover key

**Roles:** Controller applies the migration via Supabase Management API; the executor verifies with the QA account via CDP. Context: Supabase project `jaaeeyeyidvekzdssqfv` (Tokyo), Management API PAT `sbp_...` (never commit), QA login `qa.dashboard.latency@example.com` / `Latency!Probe2026`, CDP `ws://127.0.0.1:9228`, prod `money-map-ph.vercel.app`.

- [ ] **Step 1: Apply migration `007` to the cloud DB (controller)**

POST `https://api.supabase.com/v1/projects/jaaeeyeyidvekzdssqfv/database/migrations` with header `Authorization: Bearer <PAT_REDACTED>` and body:

```json
{ "version": "007", "statements": ["ALTER TABLE public.income_sources ADD COLUMN type TEXT NOT NULL DEFAULT 'core' CHECK (type IN ('core', 'incentive'));"] }
```

Verify HTTP 201/200. Then confirm the column exists + defaults:

```sql
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'income_sources' AND column_name = 'type';
```

Expected: one row, default `'core'::text`, nullable = NO.

- [ ] **Step 2: Seed QA data (controller or via app)**

Using QA user id `03ba64e7-80a6-48f0-86f1-5dc8a74eb926`:
1. Verify all existing `income_sources` rows have `type = 'core'`.
2. Set one QA source to `incentive` (e.g. the source used by the QA income entry). If none exists, create an incentive source via the Settings UI and log an incentive entry dated inside the current cutoff (2026-09-08 → period A 2026-08-29..2026-09-13).
3. Record the QA paycheck/entry/expense numbers for the current period.

- [ ] **Step 3: Verify dashboard card (executor, CDP)**

Load `https://money-map-ph.vercel.app/dashboard` in the authenticated Chrome tab. Assert `#` — visually: the Safe to Spend card shows the period-scoped subtitle ("this cutoff · ends Sep 13"), a positive/emerald value, and "X days left". Cross-check the number against the seeded math: `coreIncome + incentiveIncomeLogged − spentThisPeriod`.

- [ ] **Step 4: Verify income-page card (executor, CDP)**

Load `/income`, open the "Allocate Paycheck" tab. Assert the "This cutoff" card shows "Sep 29 – Sep 13"-style range, the breakdown rows (Core income / Incentives logged / Spent this cutoff), and that the safe-to-spend value matches the dashboard card.

- [ ] **Step 5: Verify the Settings selector (executor, CDP)**

Load `/settings` → "Income Sources". Edit the QA incentive source: the type `Select` prefills "Incentive". Change it to "Core income", save, reload, confirm Badge disappears and the income-page incentive line drops to 0. Restore it to "Incentive".

- [ ] **Step 6: Verify rollover key behavior**

Confirmed structurally by Task 3 test "rolls the window to period B on the 14th" plus the periodEnd-scoped cache key. On the cutoff rollover (after Sep 14), reload `/dashboard` and confirm the card now reads "ends Sep 28" and the numbers reflect period B (0 core income until the next paycheck is logged — the honest zero).

- [ ] **Step 7: Full gates + final review**

Run: `npx tsc --noEmit`
Run: `npm test`
Run: `npm run lint`
Run: `npm run build`

Then request a whole-branch review (spec §13; V1 precedent: T9 followed by a ship-it review) before push/deploy.

- [ ] **Step 8: Commit any verification fixes**

If verification surfaced bugs, fix them in dedicated commits (prefer a fresh task review over amending). If verification was clean, an empty verification commit is acceptable and matches V1 precedent:

```bash
git commit --allow-empty -m "feat(verify): V2+V4 safe-to-spend live-verified"
```

---

## Self-Review notes (post-write)

- **Spec coverage:** §3 migration + type → Task 1; §5 engine helper → Task 2; §6 service + §4 aggregation rules + §7 cache → Task 3; §8a dashboard card → Task 4; §8b income-page card → Task 5; §8c settings selector → Task 6; §11 testing + §12 live verification → Tasks 7–8. Edge cases from §9 are covered by Task 3 tests (overspent, rollover, override/null fallback, inclusive boundary).
- **Type consistency:** `SafeToSpendStatus`, `PeriodProgress`, `income_sources.type`, `sourceSchema.type`, `cachedGetSafeToSpend` are defined once (Task 1/2/3) and consumed by name (Tasks 3/4/5/6) with matching field names throughout.
- **No placeholders:** all code and test bodies are written in full; migration statements are complete; verification steps reference concrete endpoints and QA identities.