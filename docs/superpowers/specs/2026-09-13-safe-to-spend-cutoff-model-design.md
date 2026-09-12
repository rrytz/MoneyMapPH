# Safe-to-Spend Cutoff Model (V2+V4)

**Date:** 2026-09-13
**Status:** Draft for review
**Program:** MoneyMap PH — variable-income companion program (V1 shipped: pay-period engine + lean-cutoff detection)

---

## 1. Goal

Give users a single, honest answer to "how much can I spend until my next paycheck?" — a **safe-to-spend figure scoped to the current 13th/28th cutoff period**:

```
safeToSpend = coreIncome(period) + incentiveIncomeLogged(period) − spentThisPeriod
```

V2 builds the computation (migration, engine progress helper, service, cache, types).
V4 builds the display layer (dashboard KPI card, income-page period card, Settings source-type selector).

This is **Approach A** from the V1 design: a compute-only overlay. The calendar-month budget model, health score, and lean detection are **untouched**.

---

## 2. The two-sided rule (recap + extension)

Locked in V1: **core income = paychecks only.** Incentives are never part of the lean baseline.

V2 extends the rule to safe-to-spend for **when** each side is counted:

| Income side | Representative record | Counts toward lean baseline | Counts toward safe-to-spend |
|---|---|---|---|
| Core (salary paychecks) | `paychecks` | Yes | Yes — when logged in the period |
| Incentive (bonus, commission, OT) | `income_entries` from `incentive`-type sources | **Never** | **Only when logged** (in the period) |

The asymmetry is deliberate and consistent: incentives are felt in your wallet only when they actually arrive, and they must not inflate the income baseline used to detect lean periods.

---

## 3. Data model change — `income_sources.type`

### Problem
Incentive income is not structurally distinguishable today. `income_sources` are user-managed free-text names; inferring "incentive" from names would break on typos/renames.

### Change
Migration `007_income_source_type.sql`:

```sql
alter table income_sources
  add column type text not null default 'core'
  check (type in ('core', 'incentive'));
```

- Defaults all existing + new sources to `'core'` (safe/conservative: nothing retroactively becomes an incentive).
- Similar to the V1 lean guard: the uncommon case (incentive) is made explicit via an opt-in signal, never inferred.
- No index needed. No new table → no new RLS policy (existing `income_sources` RLS covers it).

### Type-level
```ts
export type IncomeSourceType = "core" | "incentive";
export interface IncomeSource {
  id: string; user_id: string; name: string;
  type: IncomeSourceType;              // NEW
  is_default: boolean; sort_order: number; created_at: string; updated_at: string;
}
```

---

## 4. Income aggregation rules (safe-to-spend)

Scope for all figures: the **current cutoff period** `[periodStart, periodEnd]` = `getCutoffPeriodForDate(now)`.

| Term | Definition |
|---|---|
| `coreIncome` | Σ `paychecks.amount` for paychecks assigned to the current period |
| `incentiveIncomeLogged` | Σ `income_entries.amount` where `date` in period **and** source is `type = 'incentive'` |
| `spentThisPeriod` | Σ `expenses.amount` where `date` in period (inclusive) |
| `safeToSpend` | `coreIncome + incentiveIncomeLogged − spentThisPeriod` |

### Paycheck-to-period assignment
A paycheck is assigned to the period via its `period_end` when set; when `period_end IS NULL` (legacy rows), fall back to bucketing by `date` within `[periodStart, periodEnd]`. This respects the T7 cutoff override (user intent) while handling pre-V1 rows.

### What does NOT count toward safe-to-spend
- `income_entries` whose source is `type = 'core'`. Core income is represented by paychecks only (consistent with the V1 lean baseline). Users who want core income reflected must log paychecks — same expectation V1 already established.
- Paycheck-linked `income_entries` are implicitly excluded by the above rule only if they reference an incentive source; linked entries to core sources are excluded by the core rule. No explicit `paycheck_id` filtering is required by the formula.

### Empty/insufficient state
If the user has **zero paychecks** (`hasPaychecks = false`), the card shows guidance ("Log your paycheck to unlock safe-to-spend") rather than a misleading zero/negative number.

---

## 5. Engine addition — period progress (pure)

Add to `src/lib/utils/pay-period.ts`:

```ts
export interface PeriodProgress {
  daysTotal: number;
  daysElapsed: number;
  daysRemaining: number;
  fractionElapsed: number;
}

export function getPeriodProgress(periodEnd: Date, now: Date = new Date()): PeriodProgress
```

- `periodStart` via existing `getPeriodRange`.
- `daysTotal = periodEnd − periodStart + 1` (inclusive).
- `daysElapsed` clamped to `[0, daysTotal]`; `daysRemaining = daysTotal − daysElapsed`.
- `fractionElapsed` in `[0, 1]`.
- Used for the "X days left in this cutoff" line and any progress bar.

---

## 6. Service — `getSafeToSpend`

New file `src/lib/services/safe-to-spend.service.ts`:

```ts
export async function getSafeToSpend(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<SafeToSpendStatus>
```

Query sequence (one parallel fetch group):
1. `currentPeriod = getCutoffPeriodForDate(now)`; derive `periodStart`/`periodEnd` ISO strings + `payoutDate`.
2. Paychecks: `user_id` AND (`period_end` = periodEnd OR (`period_end` IS NULL AND `date` between)). → `coreIncome`.
3. `income_sources`: `user_id` AND `type = 'incentive'` → incentive source IDs.
4. `income_entries`: `user_id` AND `source_id IN (incentive ids)` AND `date` between. → `incentiveIncomeLogged`.
5. `expenses`: `user_id` AND `date` between. → `spentThisPeriod`.

### Type
Add to `src/lib/types/index.ts`:

```ts
export interface SafeToSpendStatus {
  periodStart: string;
  periodEnd: string;
  payoutDate: string;          // from engine (weekend-shifted)
  coreIncome: number;
  incentiveIncomeLogged: number;
  spentThisPeriod: number;
  safeToSpend: number;         // coreIncome + incentiveIncomeLogged − spentThisPeriod
  hasPaychecks: boolean;
  daysElapsed: number;         // from getPeriodProgress
  daysTotal: number;
  daysRemaining: number;
  fractionElapsed: number;
}
```

---

## 7. Caching

Add `cachedGetSafeToSpend(supabase, userId, now?)` to `src/lib/cache/shared-queries.ts`, mirroring `cachedGetLeanStatus`. The aggregate cache key includes `userId` + `periodEnd` so a cutoff rollover (now past `periodEnd`) never returns a stale period's numbers.

---

## 8. Display layer (V4)

### 8a. Dashboard — Safe-to-Spend card
New component `src/components/dashboard/safe-to-spend-card.tsx` (distinct from the uniform `KpiCard` — per the Q2 decision to avoid reading as a duplicate of **Remaining Budget**):

- **Title:** "Safe to Spend"
- **Subtitle:** "this cutoff · ends <Sep 28>" — the explicit period-end date is mandatory so it reads as a different kind of number than Remaining Budget (calendar month).
- **Right-of-number line:** "X days left in this cutoff" (+ progress bar).
- **State-aware accent:**
  - Positive → emerald
  - Low (≤ 20% of received) → amber
  - Negative (overspent) → rose, label changes to "Over this cutoff" with honest copy
- **Incentive line:** "+ ₱X incentives logged this cutoff" shown only when > 0.
- **Empty state:** zero paychecks → dashes + "Log your paycheck to unlock safe-to-spend".
- Dashboard `page.tsx` fetches via `cachedGetSafeToSpend` (parallel with existing queries) and renders the card next to Remaining Budget with a visually distinct treatment.

### 8b. Income page — "This cutoff" card
In `income-page-client.tsx`, inside the **Allocate Paycheck** tab beneath the `LeanStatusChip`:

- Compact card: period range ("Sep 14 – 28"), safe-to-spend amount, and a 3-row breakdown (Core income, Incentives logged, Spent this cutoff).
- Lower-key styling (the LeanStatusChip already establishes period context here).
- Server page (`income/page.tsx`) fetches via `cachedGetSafeToSpend` and passes through props.

### 8c. Settings — income source type selector
- `settings-client.tsx` source modal: add a type control (segmented/select "Core income / Incentive"), defaulting to **core**; prefill on edit.
- `settings/actions.ts` `addIncomeSourceSetting` / `editIncomeSourceSetting`: accept `{ name, type }`; extend `sourceSchema` with `z.enum(["core", "incentive"])` (default `"core"`).
- `category.service.ts` `createIncomeSource` / `updateIncomeSource`: accept `type` in `data`, persist it.
- Source list: small "incentive" badge on `incentive` sources.

The **Log Income** form is unchanged; the type lives on the source, not the entry.

---

## 9. Edge cases

| Case | Behavior |
|---|---|
| Negative `safeToSpend` | Rose state, "Over this cutoff" copy — no shaming, just honest |
| Zero paychecks | `hasPaychecks=false` → guidance empty-state |
| Period rollover | `getCutoffPeriodForDate(now)` always yields the in-progress period; no stale caching |
| Incentive logged after cutoff | `date`-scoped → counts in the period the entry actually falls in |
| Expense on `periodEnd` | Inclusive boundary |
| Weekend payout | engine `payoutDate` already shifts Sat→Fri; only display |
| Core-type manual `income_entries` | Not counted (core income = paychecks, per V1) |

---

## 10. Non-goals

- No change to the calendar-month budget/health model (Approach A overlay).
- No `period_end` column on expenses (K2 bills calendar will revisit).
- No change to lean detection, trailing median, or the 0.75 threshold.
- No removal or merging of the Remaining Budget KPI; both remain, clearly differentiated.
- No new tables, no new RLS policies.

---

## 11. Testing

- **Engine (pure):** `getPeriodProgress` — normal, boundary, clamped (now before start / after end).
- **Service (mocked supabase):** empty user; paychecks only; core + incentive; overspent; incentive-only; core-entry exclusion; period_end override respected; NULL period_end fallback; inclusive date boundaries.
- **Components:** safe-to-spend card (positive/low/negative/empty), settings type selector default + edit prefill.
- **Migration:** applied to cloud via Supabase Management API (per V1 T9 pattern); verify default `'core'` and CHECK constraint.
- **Gates:** `tsc`, vitest, lint, production build.

---

## 12. Live verification (per V1 T9 pattern)

Seed QA account (`qa.dashboard.latency@example.com`):
1. After migration, verify `income_sources` rows default to `type = 'core'`.
2. Mark/seed one QA source as `incentive`.
3. Add an incentive `income_entry` in the current cutoff period; add an expense.
4. Verify dashboard card + income-page card reflect: `core + incentive − spent`.
5. Re-run the verification when the cutoff rolls over (periodEnd crossing) to confirm cache invalidation.

Visual check via CDP at `ws://127.0.0.1:9228` (authenticated as QA), prod at `money-map-ph.vercel.app`.

---

## 13. Program task split (for the implementation plan)

- **P1 [V2]** Migration `007` + type + `IncomeSource.type` propagation + tests
- **P2 [V2]** Engine `getPeriodProgress` + tests (+ `PeriodProgress`)
- **P3 [V2]** Service `getSafeToSpend` + `SafeToSpendStatus` + tests
- **P4 [V2]** Cache `cachedGetSafeToSpend` (periodEnd-scoped key)
- **P5 [V4]** Dashboard Safe-to-Spend card + dashboard wiring
- **P6 [V4]** Income page "This cutoff" card + page/client wiring
- **P7 [V4]** Settings source-type selector (client + actions + service + schema)
- **P8 [Verify]** Live verification against prod + QA seeding + cutoff rollover check