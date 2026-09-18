# Backlog

> **This file is the single canonical home for deferred items.** Anything
> decided during design, review, verification, or close-out that is **not**
> being built now — but is worth doing later — lands here, grouped by the
> feature/source it comes from. Do not scatter deferred items across per-feature
> SDD ledgers or chat reports; supersede those with an entry in this file.
>
> Each entry records: what it is, why it matters, and where it was first
> raised/sourced so it stays traceable. Anything here is intentionally out of
> scope for the feature it references.

## Income & paychecks (V1 — pay-period engine / lean detection)

- **V1-A. Trailing-median includes logged-but-in-flight periods.**
  `getTrailingCutoffIncomes` counts logged-but-in-flight periods toward the
  median and `MIN_LEAN_PERIODS`, while the spec says completed periods only.
  Target selection unaffected, but the lean ratio can be nudged by an unallocated
  paycheck. Fix would filter in-flight periods out of the trailing window.
  Source: V1 final review, minor (1) — `.superpowers/sdd/2026-09-08-pay-period-engine-lean-detection/progress.md:54`.

- **V1-B. Paycheck-form empty-date → invalid cutoff.**
  An empty `period_end` in the paycheck form flows through `parseISO('')` and
  yields an Invalid-Date cutoff (cosmetic today — submission is blocked by
  `paidAt`/`periodEnd` validation). Fix: guard the empty-string path before
  `parseISO`. Source: V1 final review, minor (2) — same progress file.

- **V1-C. `period_end` validator lacks an ISO regex.**
  `paycheckSchema.period_end` has no ISO-format validation, so malformed dates
  are only rejected by the DB (no friendly error). Form always sends valid ISO,
  so this is a validation backstop gap. Source: V1 final review, minor (3) —
  same progress file.

## Bills & calendar (K2)

- **K2-A. Paycheck fetch is capped at `.limit(50)` (M2).**
  `safe-to-spend.service.ts:21` only pulls the 50 most recent paychecks for the
  cutoff window. Beyond 50 paychecks in a pay period, older ones are silently
  dropped from the lean / safe-to-spend math. Fix: page or filter instead of
  hard-capping. Source: K2 backlog list, "M2 (.limit(50) paychecks)" —
  `.superpowers/sdd/2026-09-13-bills-calendar/progress.md:197`.

- **K2-B. Additional service test coverage (M3).**
  `updateBill` (bills service) is untested; the Task 2 mandate kept the four
  verbatim assertions only. Broaden coverage: `updateBill`, plus the
  boundary/edge cases called out in later task reviews (e.g. `getBillView`
  paid-total window, `getBillsDueBy` lookback inclusivity). Source: K2 backlog
  list, "M3 (service coverage)" + Task 2 deferred note — same progress file.

- **K2-C. Payout chevron fix.**
  The payout chevron / payout-date affordance in the pay-check UI (K2 plan
  line 2234 area) was deferred by explicit user decision at K2 close-out
  ("chevron fix NOT selected"). Still worth a dedicated small task. Source:
  K2 close-out adjudication — same progress file:183.

- **K2-D. Coverage-alert dismiss flake.**
  Dismissing the bills coverage alert can flake (dismissed alert can surface
  again, or fail to persist reliably across client re-renders). Fix would add a
  durable dismissal per notice. Source: K2 close-out backlog entry — same
  progress file:183.

- **K2-E. 60s `unstable_cache` lag.**
  Cached financial wrappers are held for `REVALIDATE_SECONDS = 60`, so after an
  action revalidates, a same-roundtrip repeat request can still get the stale
  entry (version-subtle). Confirm/decide acceptable staleness vs. reconciling
  cache-busting. Source: K2 Task 10 live-gate note + close-out backlog entry —
  same progress file:143,183.

- **K2-F. `dueSoonKey` order-independence test gap.**
  `dueSoonKey` is order-independent (sorts before keying), but no test locks
  `key([b,a]) === key([a,b])` — the current cases are single-element or
  same-array only. Regression guard. Source: K2 Task 9 reviewer nit — same
  progress file:167.

- **K2-G. Cutoff-rollover / period-B number transitions re-check.**
  Re-verify live (>= 2026-09-14) that period-A→period-B rollover — totals,
  `payoutDate`, safe-to-spend, and the upcoming/paid figures — transitions
  cleanly across the cutoff boundary (structural fix already used
  periodEnd-scoped cache keys + a unit test; live confirmation deferred).
  Source: K2 close-out backlog entry + safe-to-spend ledger
  `progress.md:36`, `progress.md:183`.

- **K2-H. Notices-array gap.**
  Coverage notices rely on the assembled notices array; a structural gap was
  noted at K2 close-out (edge case where a notice could be dropped from the
  set). Re-audit notice assembly/dedup. Source: K2 backlog list, "notices-array
  gap" — same progress file:197.

- **K2-I. `pay_bill` doesn't validate due date vs. `day_of_month`.**
  `pay_bill` accepts any `p_due_date`; a payment on a non-occurring date never
  renders on the calendar (UI usually passes the occurrence's due date, so mostly
  a DB-tier depth gap). Consider rejecting/coercing in the RPC. Source: K2
  Task 3 deferred nit "N-ghost" — same progress file:100.

- **K2-J. Bills CRUD delete lacks `window.confirm`.**
  `BillsCrud` deletes without a confirmation (plan verbatim at the time). Add a
  confirm step before destructive delete. Source: K2 Task 8 reviewer nit —
  same progress file:155.

## Savings goals / income entry (cross-cutting, post-K2)

- **X-A. Supabase join type casts.**
  Joined selects are type-unsafe casts:
  - `src/app/(dashboard)/dashboard/page.tsx:77,87` — recent income/expenses
    joined onto `source`/`category` via `as unknown as { ... }`.
  - `src/lib/services/financial.service.ts:120` — `budget_categories as unknown as`.
  Replace with typed row shapes (derived/generated types), removing the
  `as unknown` debt. Source: session-history audit of aggregate/join sites.

- **X-B. Floating-point rounding in `.reduce()` sums.**
  Financial totals are summed as raw `Number(amount)` floats with no
  cent-alignment, so FP error can accumulate (e.g. 0.1 + 0.2 ≠ 0.3) at sites like
  `src/lib/services/financial.service.ts:41-45`,
  `src/lib/services/safe-to-spend.service.ts:46-59`,
  `src/lib/services/expense-aggregation.service.ts:10`,
  `src/app/(dashboard)/income/page.tsx:46`. Standardize on a
  `roundMoney`/`sumMoney` helper (round to 2dp after accumulation) across
  aggregate reducers. Source: session-history audit.

## Monthly snapshots (post-K2)

- **NEW-A. Historical snapshot backfill for drifted months.**
  Bill payments made **before** the bundled fix (K2-era and earlier) never
  regenerated `monthly_snapshots`, so months whose only money-surface activity
  was bill payments can drift (their `total_expenses` undercounts). Decision made
  during the Debt-tracking design review: **fix forward only** (see Debt feature
  for the forward fix); the historical backfill is intentionally out of scope and
  should be a service-layer utility reusing the get-monthly-summary /
  generate-snapshot pathway **per month, not a SQL migration**. Source:
  Debt-tracking design review (2026-09-18) — decided by user directive to file as
  a backlog item rather than build into the feature.