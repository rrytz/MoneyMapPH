# V1 — Pay-Period Engine + Lean-Cutoff Detection

Date: 2026-09-08
Status: Approved (brainstorm) · Pending plan

## 1. Purpose

The app's budgeting, snapshots, forecasting, and Health Score all reason in **calendar months**. The target user — a Filipino BPO/call-center worker — earns on a **cutoff cadence**: the 13th and 28th of each month, with payday rolling back to the preceding Friday when an anchor falls on a weekend. Their real question is not "how is my month?" but "is this cutoff lean?" V1 builds the engine that answers that, and it is the required foundation for V2 (cutoff money model / safe-to-spend), K2 (bills calendar), per the approved dependency chain.

### Locked decisions (from brainstorm)
1. **Cutoff anchors**: 13th and 28th of every month, fixed. Period-end dates never move; only the **pay-out date** shifts to the preceding Friday when the anchor is Saturday or Sunday.
2. **Core income** = dedicated per-period `paychecks` rows only. **Two-sided incentive rule**: incentives/supplemental income are **excluded from the baseline** (they would make every no-bonus cutoff look lean), but will count toward safe-to-spend only once actually logged (V2). V1 tracks core only.
3. **Month-authoritative overlay**: monthly snapshots, budgets, forecasts, and Health Score remain the source of truth. The period view is derived on top; it never forks the monthly data model.
4. **Attribution**: `paychecks.period_end` (the cutoff anchor date) is stored **explicitly** at creation (pre-filled from the pay date by the engine), not inferred on every read.
5. **Lean threshold**: `LEAN_CUTOFF_THRESHOLD = 0.75` as a named pure parameter threaded through the classification function. **Fixed default now, no settings UI** — a user-facing control is deferred until V2 makes the number actionable (a `user_profile.lean_threshold` column + slider later, zero classification-code change).
6. **History guard**: the lean flag is suppressed until **≥6 logged periods** exist. Periods with no paycheck logged are excluded from the window and never treated as "lean ₱0." The current in-flight period is never classified.

## 2. Pay-period date engine — `src/lib/utils/pay-period.ts` (pure, no Supabase)

All functions take real `Date`s, use `date-fns`, and are exhaustively unit-tested. Constants: `CUTOFF_DAYS = [13, 28]` (export, no magic numbers).

| Function | Behavior |
|---|---|
| `getCutoffPeriodForDate(date)` | Returns `{ periodEnd, periodStart }` of the worked period containing `date`. Period A: `[prev-28th + 1 .. 13th]`; Period B: `[14th .. 28th]`; days 29–31st belong to the **next month's** 13th cutoff. |
| `getPayoutDateForPeriodEnd(periodEnd)` | The 13th or 28th, unless Saturday/Sunday → **preceding Friday**. |
| `getPeriodRange(periodEnd)` | `{ start, end }` worked range (end ≡ periodEnd). |
| `listCutoffPeriodsBetween(start, end)` | Every cutoff (periodEnd, periodStart, payoutDate) in a range — for history rollups. |
| `estimatePeriodEndForPayout(payoutDate)` | Reverse rule for the paycheck form pre-fill and SQL backfill: the cutoff whose computed payout equals the date; fallback = cutoff whose worked range contains the date. |

**Test matrix (frozen day-of-week):**
| periodEnd | weekday | payoutDate |
|---|---|---|
| 2026-09-13 | Sunday | 2026-09-11 (Fri) |
| 2026-09-28 | Monday | 2026-09-28 (Mon) |
| 2026-10-13 | Tuesday | 2026-10-13 (Tue) |
| 2026-11-28 | Saturday | 2026-11-27 (Fri) |
| 2026-12-13 | Sunday | 2026-12-11 (Fri) |
| 2027-02-13 | Saturday | 2027-02-12 (Fri) |

Plus: 2026-12-29 → belongs to 2027-01-13 cutoff; Feb runs (28 days); month/year boundary range listing.

## 3. Schema — `supabase/migrations/006_pay_period_engine.sql`

- `ALTER TABLE public.paychecks ADD COLUMN period_end DATE;`
- `CREATE INDEX idx_paychecks_user_period_end ON public.paychecks(user_id, period_end);`
- **SQL backfill** in the same migration: for each existing row, `period_end` = the candidate cutoff (prev-month 28th, this-month 13th, this-month 28th, next-month 13th) whose weekend-shifted payout date equals `paychecks.date`, else NULL. Weekday shift in SQL: Saturday(`dow=6`) → `-1`, Sunday(`dow=0`) → `-2`.
- Rows that match no candidate stay NULL; the engine **excludes NULL rows** from classification and paycheck saves write it back. No NOT NULL constraint (keeps the migration safe for pre-existing data).
- RLS: existing `paychecks` policies already cover the new column — no policy changes.

## 4. Service layer — `src/lib/services/pay-period.service.ts`

- `getPeriodCoreIncome(supabase, userId, periodEnd)` → `SUM(paychecks.amount)` for that `period_end`.
- `getTrailingCoreIncomes(supabase, userId, { periods: 24 })` → newest N completed periods, **including only periods with ≥1 paycheck** (NULL `period_end` rows excluded); sorted desc.
- `getLeanStatus(supabase, userId)` → `LeanStatus`:
  - `targetPeriodEnd` = newest completed period (payoutDate ≤ today) that has ≥1 paycheck.
  - `median` = median of `getTrailingCoreIncomes` window (≤24 periods) — core paychecks only.
  - `ratio` = targetIncome ÷ median.
  - `phase`: `"insufficient"` if window has < `MIN_LEAN_PERIODS` (6) or no target; `"lean"` if `ratio < LEAN_CUTOFF_THRESHOLD`; else `"normal"`.
  - exposes `median`, `ratio`, `targetIncome`, `threshold`, `periodsUsed`, `windowPeriods` for transparent UI copy.
- **Cached wrapper** `cachedGetLeanStatus` in `src/lib/cache/shared-queries.ts`: `revalidate: 60`, tag `q:lean:<userId>` — matches existing `cachedGet*` conventions; invalidation rides existing `revalidatePath("/income")` + `revalidatePath("/dashboard")` on paycheck mutations (already present in `addPaycheck`/`removePaycheck`).

## 5. Mutations & form

- `paycheckSchema` (validators): add optional `period_end` (ISO date string).
- `createPaycheck` service + `addPaycheck` action: accept `period_end`; the **engine pre-fills it** when omitted.
- `PaycheckPlanner` form: "Cutoff" field pre-filled from the entered pay date via `estimatePeriodEndForPayout`; a small select allows override between the two candidate cutoffs (13th/28th). Read-only copy confirms the worked range.
- No `updatePaycheck` exists today; out of scope (period_end is corrected on next create; NULL rows heal on save).

## 6. Signal surfaces (V1, deliberately minimal)

1. **Lean-cutoff notification** — added to `getDynamicNotifications` (runs in its existing `Promise.all`): when `phase === "lean"`, push a warning: title "Lean cutoff detected"; message "You earned ₱X for the [Cutoff label] vs your typical ₱Y (Z% below). Variable budgets will suggest tightening next cutoff." Suppressed on `insufficient`/`normal`. Reuses the drawer — the dashboard-alert route already covers dashboard reach.
2. **Income page chip** — `income/page.tsx` fetches `cachedGetLeanStatus` and passes it to `income-page-client.tsx`; a header chip renders:
   - `lean` → "Lean cutoff · −Z% vs your typical"
   - `normal` → "On track · ₱X vs typical ₱Y"
   - `insufficient` → "Reading your cutoffs… lean alerts need ~3 months of paychecks"
   Tooltip explains the income basis (checks only) and period count.

   No dashboard widget in V1 (Income is where paychecks live; notifications already reach the dashboard). No budget-suggestion code — V1 emits classification + ratio only; tightening is explicitly V2's job.

## 7. Testing

- `src/tests/pay-period.test.ts` — full pure-date matrix from §2 plus reverse-estimate and range-listing cases.
- `src/tests/pay-period.service.test.ts` — mock Supabase (pattern from `financial.service.test.ts`): rollup grouping, NULL-`period_end` exclusion, empty-period exclusion, median over trailing window, `insufficient` (<6), `lean`/`normal` at the threshold boundary, `ratio === 0.75` boundary behavior.
- Regression: full suite (71 tests) stays green; `financial/forecast/snapshot` services untouched.
- Live (headless Chrome, QA account): create paychecks with crafted dates/amounts → verify chip across `insufficient → normal → lean`, notification fires on lean, existing income/budgets pages render unchanged.

## 8. Files

**New:** `src/lib/utils/pay-period.ts`, `src/lib/services/pay-period.service.ts`, `src/tests/pay-period.test.ts`, `src/tests/pay-period.service.test.ts`, `supabase/migrations/006_pay_period_engine.sql`.

**Modified:** `src/lib/cache/shared-queries.ts`, `src/lib/services/paycheck.service.ts`, `src/app/(dashboard)/income/actions.ts`, `src/lib/utils/validators.ts`, `src/app/(dashboard)/income/paycheck-planner.tsx`, `src/app/(dashboard)/income/page.tsx`, `src/app/(dashboard)/income/income-page-client.tsx`, `src/lib/constants.ts` (`LEAN_CUTOFF_THRESHOLD`, `MIN_LEAN_PERIODS`), `src/lib/services/notification.service.ts`, `src/lib/types/index.ts` (`LeanStatus`).

**Explicitly untouched** (overlay guarantee): `financial.service`, `forecast.service`, `snapshot.service`, budget services, Health Score math.

## 9. Scope boundaries

- No incentive/supplemental tracking or display in V1 (realization side of the two-sided rule is V2).
- No actual budget tightening, no period-spend view, no bills (V2/K2).
- No settings UI for the threshold; no dashboard income widget in V1.