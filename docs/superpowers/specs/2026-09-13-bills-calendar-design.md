# K2 — Bills Calendar (cutoff-aware)

Date: 2026-09-13
Status: Approved (brainstorm) · Pending plan

## 1. Purpose

The app's cutoff model (V1 lean detection, V2 safe-to-spend) tells a Filipino BPO/call-center worker "is this cutoff lean?" and "how much is left to spend this cutoff?" K2 answers the adjacent, more actionable question: **"which bills are due before my next paycheck, and can what's left cover them?"** Bills are tracked as first-class recurring obligations (rent, utilities, internet, SSS/Pag-IBIG/PhilHealth, subscriptions, loans) with a calendar view, a pay-flow that logs a real expense, and a coverage verdict against safe-to-spend.

### Locked decisions (from brainstorm)
1. **Domain boundary**: bills are a new financial entity distinct from the generic `reminders` to-do table (which keeps its dismissible-checklist semantics unchanged). No overloaded `completed` boolean.
2. **Recurrence**: monthly on `day_of_month` (1–31), occurrences computed by clamping to the last day of the month (Feb 29 → Feb 28 in non-leap years; 31st → 30th).
3. **Pay flow**: "Pay" opens a quick form (amount prefilled from expected, category prefilled from the bill link), then **logs an expense** linked to that month's occurrence. All-or-nothing via database RPCs.
4. **Cutoff anchoring**: derived, never stored. Each occurrence's cutoff is computed from its due date via the V1 engine (`getCutoffPeriodForDate`). No `period_end` column on bills or expenses.
5. **Ready-gate + pause-toggle (two independent gates, "nothing invented reaches an active state")**: a bill counts on money surfaces only when **ready** (`expected_amount IS NOT NULL AND day_of_month IS NOT NULL`) **AND** **active** (`active = true`, the user pause toggle, default true). Money-surface gate = `ready AND active`. The CRUD list is the single place every bill always shows, labeled (`Incomplete` — with the missing field, `Paused`, normal).
6. **Never invent a number**: seeded template rows arrive `active = true` but with `expected_amount = NULL` and `day_of_month = NULL` — not `ready`, so they are invisible to every money surface until the user explicitly sets both fields. No fake placeholder amounts or due days.
7. **Actual beats forecast**: once an occurrence is paid, every summary uses the actual paid amount; `expected_amount` is used only where no payment exists.
8. **Navigation stays at 8 items**: Bills lives as a second tab inside **Income** (`/income?tab=bills`). Domain ownership over usage frequency — Income owns the cash-flow-coverage question via the cutoff/safe-to-spend model. `NAV_ITEMS` and the sidebar are untouched.
9. **Surfaces shipped**: Bills tab (calendar + CRUD), "before next paycheck" summary, drawer alerts (`bills-due-soon-<setHash>`, `bills-coverage-<periodEnd>`). Dashboard widget is deferred.

## 2. Data model — `supabase/migrations/008_bills_schema.sql`

### 2.1 `public.bills`

| Column | Definition |
|---|---|
| `id` | UUID PK default `gen_random_uuid()` |
| `user_id` | UUID NOT NULL REFERENCES `auth.users(id)` ON DELETE CASCADE |
| `name` | TEXT NOT NULL |
| `expected_amount` | NUMERIC(12,2) NULL, `CHECK (expected_amount IS NULL OR expected_amount > 0)` — NULL until the user sets it (ready condition 1) |
| `category_id` | UUID NULL REFERENCES `expense_categories(id)` ON DELETE SET NULL — optional link, prefill for the pay quick-form |
| `day_of_month` | INTEGER NULL, `CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31)` — NULL until the user sets it (ready condition 2) |
| `active` | BOOLEAN NOT NULL DEFAULT true — the pause toggle |
| `notes` | TEXT |
| `created_at` / `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() / trigger-set |

- **Ready** = `expected_amount IS NOT NULL AND day_of_month IS NOT NULL`. **Money-surface gate** = `ready AND active`. **Management list** = all rows regardless.
- Index `idx_bills_user ON bills(user_id)`. RLS: SELECT/INSERT/UPDATE/DELETE policies mirroring the user-scoped pattern (`auth.uid() = user_id`). `set_updated_at` trigger.

### 2.2 `public.bill_payments`

| Column | Definition |
|---|---|
| `id` | UUID PK default `gen_random_uuid()` |
| `bill_id` | UUID NOT NULL REFERENCES `bills(id)` ON DELETE CASCADE |
| `due_date` | DATE NOT NULL — the exact clamped occurrence date being paid |
| `paid_at` | DATE NOT NULL — the actual payment/expense date |
| `amount` | NUMERIC(12,2) NOT NULL `CHECK (amount > 0)` — the actual paid amount (audit copy; see below) |
| `expense_id` | UUID NULL REFERENCES `expenses(id)` ON DELETE SET NULL — the logged expense |
| `created_at` / `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() / trigger-set |

- **UNIQUE(bill_id, due_date)** — exactly one paid occurrence per bill; double-pay is impossible at the DB tier and surfaces a clear error.
- **`amount` duplication is deliberate**: it copies the actual paid figure at payment time so the calendar/summaries stay honest even if the linked expense is later deleted (`expense_id` → SET NULL), and "paid" never depends on a join. The `expenses` row remains the financial record of truth.
- Index `idx_bill_payments_bill ON bill_payments(bill_id, due_date)`. RLS: child pattern from `paycheck_allocations` — `USING (EXISTS (SELECT 1 FROM public.bills WHERE bills.id = bill_payments.bill_id AND bills.user_id = auth.uid()))` for SELECT/UPDATE/DELETE; INSERT `WITH CHECK` same. `set_updated_at` trigger.

### 2.3 RPCs (atomicity)

Two `SECURITY INVOKER` functions (RLS policies on both tables still apply; the caller is the auth user) so each operation is a single all-or-nothing transaction — no orphan expense-without-payment state:

- `pay_bill(bill_id uuid, due_date date, paid_at date, category_id uuid, amount numeric, notes text)` → validates the bill is `ready AND active` (raises otherwise), `INSERT INTO expenses` (title = bill name, amount, category_id, date = paid_at, paycheck_id NULL) and `INSERT INTO bill_payments` (bill_id, due_date, paid_at, amount, expense_id), returns the payment row. `UNIQUE(bill_id, due_date)` rejects double-pay.
- `unpay_bill(payment_id uuid)` → deletes the `bill_payments` row **and** its linked expense in one transaction (the expense was auto-created by us; the undo is symmetric).

### 2.4 Onboarding seeding

Extend `handle_new_user` to insert template rows — all `active = true`, `expected_amount = NULL`, `day_of_month = NULL`, no category (per locked decision 5/6):

`SSS Contribution · Pag-IBIG · PhilHealth · Rent · Internet · Electricity · Water · Postpaid/Phone · Subscriptions · Loan Payment`

These render in the CRUD list as `Incomplete`; they cannot appear on the calendar, in summaries, or in notifications until the user fills amount + day (which is what flips them ready).

## 3. Pure engine — `src/lib/utils/bills.ts`

date-fns, no Supabase, exhaustively unit-tested (mirrors `pay-period.ts`).

| Function | Behavior |
|---|---|
| `isBillOnMoneySurfaces(bill)` | Returns `ready AND active` (the single money-surface predicate, unit-tested across permutations). |
| `getBillDueDate(dayOfMonth, year, month)` | Clamped: `min(dayOfMonth, lastDayOfMonth)`. Feb 29 → 29 (leap) / 28 (non-leap); the 31st → 30th in 30-day months. |
| `listBillOccurrences(bills, from, to)` | **Enforces `isBillOnMoneySurfaces` internally** — skips any bill that isn't both ready and active, so even a raw-array caller cannot leak paused/incomplete bills onto the calendar. Yields `{ bill, dueDate, expectedAmount }` per occurrence in `[from, to]`. |
| `getNextPayoutDate(from)` | `getPayoutDateForPeriodEnd(getCutoffPeriodForDate(from).periodEnd)` — V1 weekend shift included. |
| `bucketCutoff(dueDate)` | `getCutoffPeriodForDate(dueDate).periodEnd` — derived cutoff attribution, used for display only. |

The predicate lives in the engine and the engine enforces it internally; consumers never re-apply a "bills filter" when generating occurrences.

## 4. Service layer — `src/lib/services/bills.service.ts`

| Function | Behavior |
|---|---|
| `getBills` | All bills for the user, `ORDER BY day_of_month NULLS LAST` — the management array, never gated. |
| `createBill` / `updateBill` / `deleteBill` | User-scoped CRUD. `updateBill` recomputes ready-state from the posted fields and carries the `active` toggle; deleting cascades payments (deprioritized in UI — pause is primary). |
| `getBillView(supabase, userId, year, month)` | Page contract in one object (1-based `month`) — with **two separately-kept arrays**: `bills` (raw, unfiltered — feeds the CRUD list) and `occurrences` (from `listBillOccurrences`, engine-gated — feeds the calendar), plus `payments` (raw `bill_payments` in range). No single filter is shared between the two roles. |
| `getBillsDueBy(supabase, userId, fromDate, toDate)` | Windowed to the current cutoff: unpaid `ready && active` occurrences with `cutoffStart ≤ dueDate ≤ max(today+7, nextPayout)`; `paidTotal` = payments whose `due_date` is inside the same window; overdue occurrences inside the window included. `totalDue` = paid + upcoming. Returns `{ occurrences, paidTotal, upcomingTotal, totalDue, horizonDate }`. |

- Additive to existing expense/category/income behavior — no changes to `expense.service`, `financial.service`, `snapshot.service`, budget services, or Health Score.
- Cache: `cachedGetBillView` in `src/lib/cache/shared-queries.ts`, tag `q:bills:<userId>`, `revalidate: 60`; invalidation rides existing `revalidatePath` conventions on the mutation actions (see §6). `getBillsDueBy` is called inside `getDynamicNotifications` (read-time, un-cached — no new invalidation surface).

## 5. Pay flow & mutations — `src/app/(dashboard)/income/bills/actions.ts`

All mutations are server actions (pattern from income/settings actions), zod-validated schemas in `src/lib/utils/validators.ts` (`billSchema`, `payBillSchema`, `unpayBillSchema` — date regex + amount conventions from prior work):

- `payBill({ billId, dueDate, amount, paidAt?, categoryId?, notes? })` → calls `pay_bill` RPC. `dueDate` must be a valid occurrence of the bill (rejects when the bill is not `ready && active`); back-paying overdue occurrences and prepaying upcoming ones are both legal.
- `unpayBill({ paymentId })` → calls `unpay_bill` RPC.
- `createBill` / `updateBill` / `deleteBill` → service CRUD; `updateBill` flips ready-state as fields change.
- Each mutation revalidates `/income` (the host page) plus `/expenses` and `/dashboard` so `q:bills`, expense, and dashboard caches stay coherent.

Edge handling: double-pay → DB `UNIQUE` error surfaced in the action's error channel; paying a paused or incomplete bill → rejected; category chosen at pay time applies only to that payment's expense, the bill's own link is untouched.

## 6. UI — Income Bills tab

- **Route**: no new sidebar item (`NAV_ITEMS`, sidebar, `constants.ts` untouched). The Income server page (`/income`) reads `searchParams.tab`, defaulting to the existing Income view when absent; when `tab === "bills"` it additionally fetches `cachedGetBillView` (the client already receives `cachedGetSafeToSpend` — reusing it for the coverage comparison, no new fetch). `income-page-client.tsx` already uses `Tabs`; add a "Bills" tab alongside "Income".
- Three sections inside the Bills tab:

1. **Before-next-paycheck summary card** — horizon = `getNextPayoutDate(today)`. Renders the **Paid / Upcoming split**: `Paid` = actual `Σ bill_payments.amount` for paid occurrences with `dueDate ≤ horizon` ("what bills this cutoff actually cost, so far"); `Upcoming` = `Σ expected_amount` for unpaid occurrences with `dueDate ≤ horizon`, incl. overdue ("what's still due"). Copy names the payout date ("bills before your Oct 1 payout"). The **coverage verdict compares only `Upcoming` against `safeToSpend`** — nothing more — because paid bills already reduced `safeToSpend` via their expenses; comparing remaining money against the combined total would double-count. Verdict colors reuse the V2 language: emerald `covered`, amber `tight`, rose `short`. Reuses `CurrencyDisplay` and the safe-to-spend card copy conventions; guidance empty-state when the user has no ready+active bills.
   - Edge (early-paid cross-cutoff): a bill prepaid from an earlier cutoff has `dueDate` outside this window ⇒ excluded from this summary; its expense already reduced the earlier cutoff's spent. Consistent by construction — no special-casing.
2. **Month calendar** (`month-calendar.tsx`, client) — Monday-start week grid; each cell lists that day's occurrence chips (name + amount, check when paid, overdue tint when past-unpaid, dimmed when past-paid). Cutoff anchors (13th/28th) and payout chevrons drawn from the V1 engine for the displayed month. Prev/next/today navigation. Clicking an unpaid chip opens the **pay quick-form** (amount prefilled from expected, category prefilled from the bill link, paid date, notes → `payBill`); clicking a paid chip shows its expense link + `unpay`. Grid generation uses `listBillOccurrences` — engine-enforced `ready && active` per §3.
3. **Bills CRUD list** — every bill (the raw §4 array), grouped with status labels: `Incomplete` (with the missing-field callout), `Paused`, normal. Inline edit (name, amount, day-of-month, category select, active toggle, delete-deprioritized) and "Add bill" / activate-from-template (seeded rows appear here as `Incomplete`). **No bill ever vanishes from this list.**

Client components follow the existing `*-client.tsx`/`*-card.tsx` split, `useActionState`/pending patterns, and the shared UI vocabulary (FintechCard, CurrencyDisplay, tabs, dialogs/sheets as already used).

## 7. Notifications — `notification.service.ts`

Two alerts added to `getDynamicNotifications` (runs in its existing `Promise.all`; one `getBillsDueBy` call with `horizon = max(nextPayout, today + 7d)` feeds both). Both are read-time and un-cached.

| Alert | ID (deterministic, exactly-one) | Fires when | Copy |
|---|---|---|---|
| Due-soon | `bills-due-soon-<setHash>` | ≥1 unpaid `ready && active` bill with `dueDate ∈ [today, today + 7]` | "N bills due in the next 7 days · ₱Y total" |
| Coverage nudge | `bills-coverage-<periodEnd>` | `Upcoming > safeToSpend` | "Bills before your <payout> payout exceed what's left this cutoff by ₱X" |

- **Due-soon keys to its qualifying content, not to a date**: `setHash` = short hash of the canonical sorted tuple string `(bill_id, due_date, expected_amount)` over the qualifying occurrences. A 7-day window is rolling content, not a per-cutoff constant — keying it to `periodEnd` would let one dismissal silence materially different content for the whole cutoff, while keying to the rolling date (`-<horizonDate>`) would resurrect a dismissed alert daily with new IDs. Content-keying fixes both: identical qualifying content ⇒ same key (dismissal holds day-to-day); any material change — a bill entering the window, getting paid, or having its amount edited ⇒ new key ⇒ the alert legitimately re-fires. Deterministic ⇒ exactly-one-non-duplicating, consistent with the drawer's `dismissedIds`.
- **Coverage keys to `periodEnd` because its comparison is period-scoped**: both terms (`Upcoming`, `safeToSpend`) are defined relative to the current cutoff, so a period-stable ID that rotates on rollover mirrors the V1-verified `lean-cutoff-<periodEnd>` behavior — a fixed single fact per cutoff, no day-over-day drift.
- Graceful absence: no eligible bills ⇒ no alerts. Dedupe by construction (deterministic keys) consistent with the V1-verified `lean-cutoff-<periodEnd>` behavior and the drawer's `dismissedIds`.

## 8. Testing

- **Pure engine** (`src/tests/bills.test.ts`): `isBillOnMoneySurfaces` permutations; clamping matrix (Feb leap 29→29, non-leap 29→28; 31st→30th; 30-day months); `listBillOccurrences` across month/year boundaries; engine-internal predicate enforcement (raw array with paused/incomplete bills → only eligible occurrences); `getNextPayoutDate` against the V1 day-of-week matrix.
- **Service** (`src/tests/bills.service.test.ts`, mock-supabase pattern): CRUD user-scoping; `NULLS LAST` ordering; `getBillView` keeps raw + gated arrays separate; `getBillsDueBy` total = paid-actual + unpaid-expected, overdue inclusion, paused/incomplete exclusion.
- **RPCs**: `pay_bill` atomicity (both inserts or neither), double-pay rejection, `unpay_bill` symmetric removal (payment + expense), paused/incomplete rejection — via mocked rpc calls.
- **Components**: calendar cell (unpaid / paid / overdue / insufficient-not-rendered), summary card states (`covered` / `tight` / `short`, Paid/Upcoming split), activation form callout.
- **Notification-key stability**: the pure `keyForDueSoon(occurrences)` helper — same qualifying set ⇒ same key; one bill paid (exits set) / a new bill enters / an amount edit ⇒ new key; `bills-coverage-<periodEnd>` rotates only on cutoff rollover.
- **Migration**: `008` applied to cloud (Management API / `supabase db push` per the 007 pattern); verify tables, RLS policies, seeding trigger on a fresh user (templates land `Incomplete`), both RPCs deployed.
- **Gates**: `tsc`, vitest (125 tests grow), lint, production build (19+ pages).
- **Live (CDP, QA account, prod, V2 T8 pattern)**: activate a seeded template (fill amount + day) → appears; pay via quick form → verify the **expense** exists in `/expenses` and is linked; double-pay rejection; pause excludes from calendar+summary (but stays in the CRUD list); incomplete bill excluded from all money surfaces; calendar anchor/payout markers; drawer due-soon + coverage-nudge alerts (crafted safe-to-spend to force each state); summary shows paid at actual, not expected. Screenshots to the verification folder.

## 9. Files

**New:** `supabase/migrations/008_bills_schema.sql`, `src/lib/utils/bills.ts`, `src/lib/services/bills.service.ts`, `src/app/(dashboard)/income/bills/actions.ts`, `src/app/(dashboard)/income/bills-summary-card.tsx`, `src/app/(dashboard)/income/month-calendar.tsx`, `src/app/(dashboard)/income/bills-crud.tsx`, `src/tests/bills.test.ts`, `src/tests/bills.service.test.ts`, component tests for calendar/summary/activation.

**Modified:** `supabase/migrations/001_initial_schema.sql` (`handle_new_user` seeding), `src/lib/cache/shared-queries.ts`, `src/lib/utils/validators.ts`, `src/lib/types/index.ts` (`Bill`, `BillPayment`, `BillView`, `BillOccurrence`), `src/lib/services/notification.service.ts`, `src/app/(dashboard)/income/page.tsx`, `src/app/(dashboard)/income/income-page-client.tsx`.

**Explicitly untouched:** `NAV_ITEMS`/sidebar (`constants.ts`), `reminders` and its drawer checklist, `financial.service`, `forecast.service`, `snapshot.service`, budget services, Health Score math, `safe-to-spend.service` internals.

## 10. Non-goals

- No dashboard widget (deferred).
- No partial payments / split-across-cutoffs.
- No variable-range (min/max) bill forecasting.
- No paid-occurrence editing — unpay + re-pay instead.
- No stored `period_end` on bills or expenses (everything derived from due date).
- No bank sync / autopay integrations; no changes to the calendar-month budget/health overlay.
- No changes to `reminders` semantics (it remains the dismissible to-do checklist).