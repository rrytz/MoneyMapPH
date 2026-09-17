# Debt Tracking (negative goals)

Date: 2026-09-18
Status: Approved (brainstorm) · Pending plan

## 1. Purpose

MoneyMap PH tracks what you accumulate (income, savings goals) and what recurs on the cutoff (bills). Debt tracking answers the third, adjacent question: **"how much do I owe, and how fast is it shrinking?"** A debt is modeled as a *negative goal*: one total owed, one deadline, a running (derived) remaining balance that each payment reduces. Payments book real, categorized expenses so every existing money surface (Transactions, Budgets, Safe-to-Spend, Dashboard, Forecasting) picks them up with zero new plumbing.

### Locked decisions (from brainstorm)
1. **Domain home**: the **Savings page**, as a grouped "Payoff Debts" section — settled by the three-test domain-ownership framework (recurring due-date obligation? no→not Bills; cutoff cash-flow coverage? no→not Income-hub; progress toward a number? yes→Savings). The Income-hub grouping (bills + debt service in one cash-flow hub) is an aesthetic preference that loses on domain ownership; v1 has no cutoff/payout interaction for debts, so the Income tab buys no capability.
2. **Partial payments**: a debt is `total_amount` owed by one `due_date`. Each payment reduces the running balance; many payments per debt are the norm. **No stored balance** — `remaining = total_amount − Σ payments` derived always (nothing to drift).
3. **Principal only**: `total_amount` is the full payoff figure. No interest/accrual/amortization math, no APR, no monthly schedule.
4. **Every payment books a real expense**, atomically: `pay_debt` / `unpay_debt` — two `SECURITY INVOKER` RPCs mirroring `pay_bill` / `unpay_bill` byte-for-byte in structure. Unpay deletes the payment **and** its linked expense (the undo is symmetric; no orphan expenses-without-payment state).
5. **Derived payoff state**: a debt with `remaining === 0` is "Paid Off" (a derived badge); the row stays until the user deletes it. No `status` column, no archive concept.
6. **No seeding, no gates**: debts are wholly user-created — no `handle_new_user` template rows, no `ready`/`active` two-gate model (that machinery exists for Bills because Bills seeds inert templates).
7. **`deleteDebt` = `deleteBill` semantics, confirmed at both layers** (spec §4): deleting a debt cascades its payment rows but **keeps** every linked expense as ordinary financial history — real payments that happened aren't erased.
8. **Deadline is one-shot**: single `due_date`, no recurrence engine. Overdue is a derived tint (past due with `remaining > 0`); paying late is always allowed.

### Bundled K2 fix — bills snapshot regeneration (decision, not a shrug)
Audit result: `getSnapshots` is a pure read of stored `monthly_snapshots` rows (no re-compute path, `snapshot.service.ts`), and there is **no DB trigger** that refreshes snapshots on expense writes — the only `expenses` trigger (`on_expense_contribution_change` → `sync_savings_goal_amount`, migration 002) touches `savings_goals` only. Yet income, expense, and budget actions all call `generateSnapshot` for the touched month, while `payBill`/`unpayBill` (which **create a real expense**) do not. A month whose only activity is bill payments therefore under-states expenses on the Dashboard chart, emergency-fund forecast, and savings status — and never heals (a past month is rarely touched again). This is a genuine bug by the codebase's own convention, and leaving it would put **two structurally identical operations** — `pay_bill` vs `pay_debt` — on different behavior. **Decision: fix forward.** `payBill` regenerates the snapshot for `paid_at`'s month; `unpayBill` pre-fetches the payment's `paid_at` (the RPC returns void), regenerates that month after unpaying. Both gain the full expense-equivalent revalidate set (`/income`, `/expenses`, `/dashboard`, `/budgets`, `/transactions`, `/forecasting`). This ships inside the debt branch as a first-class plan task, reviewed independently. **Explicitly out of scope:** backfilling already-drifted historical months (would require duplicating `getMonthlySummary`'s aggregation in SQL across all users' history inside a feature migration; if requested, do it as a separate service-layer utility script, not in a migration).

## 2. Data model — `supabase/migrations/009_debts_schema.sql`

### 2.1 `public.debts`

| Column | Definition |
|---|---|
| `id` | UUID PK default `gen_random_uuid()` |
| `user_id` | UUID NOT NULL REFERENCES `auth.users(id)` ON DELETE CASCADE |
| `name` | TEXT NOT NULL |
| `total_amount` | NUMERIC(12,2) NOT NULL `CHECK (total_amount > 0)` — full payoff figure (principal only) |
| `due_date` | DATE NOT NULL — the single one-shot deadline |
| `category_id` | UUID NULL REFERENCES `expense_categories(id)` ON DELETE SET NULL — optional link, prefill for the pay form |
| `notes` | TEXT |
| `created_at` / `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() / trigger-set |

- Index `idx_debts_user ON debts(user_id)`. Per-user RLS policies (SELECT/INSERT/UPDATE/DELETE, `auth.uid() = user_id`). `set_updated_at` trigger. No `active`/`ready` columns (locked decision 6).

### 2.2 `public.debt_payments`

| Column | Definition |
|---|---|
| `id` | UUID PK default `gen_random_uuid()` |
| `debt_id` | UUID NOT NULL REFERENCES `debts(id)` ON DELETE CASCADE |
| `paid_at` | DATE NOT NULL — the actual payment/expense date |
| `amount` | NUMERIC(12,2) NOT NULL `CHECK (amount > 0)` — actual paid amount |
| `expense_id` | UUID NOT NULL REFERENCES `expenses(id)` ON DELETE SET NULL, **UNIQUE** — the logged expense; one expense belongs to one payment |
| `created_at` / `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() / trigger-set |

- No `UNIQUE(debt_id, paid_at)` — multiple partial payments on the same day are legitimate.
- `amount` is an audit copy (same rationale as `bill_payments.amount`): display stays honest if a linked expense is later deleted. The `expenses` row is the financial record of truth.
- Index `idx_debt_payments_debt ON debt_payments(debt_id, paid_at)`. Child RLS (Bills pattern): SELECT/UPDATE/DELETE `USING (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()))`; INSERT `WITH CHECK` same. `set_updated_at` trigger.

### 2.3 RPCs (atomicity)

- `pay_debt(p_debt_id uuid, p_paid_at date, p_category_id uuid, p_amount numeric, p_notes text DEFAULT NULL) RETURNS public.debt_payments` — `SELECT … FOR UPDATE` on the debt (race-safe), scope-check `user_id = auth.uid()` (else `debt_not_found`), reject `amount <= 0` (`amount_invalid`), **compute `remaining` inside the transaction** and reject `amount > remaining` (`amount_exceeds_remaining`) — overpay is impossible at the DB tier. Category fallback identical to `pay_bill`: passed → debt's → first default category (else `category_required`). Then `INSERT INTO expenses` (title = debt name, amount, category, date = paid_at, `paycheck_id`/`goal_id` NULL) and `INSERT INTO debt_payments` (linked `expense_id`) in one transaction, returning the payment row. `SECURITY INVOKER` — the expenses/debt_payments RLS policies still run as the calling user.
- `unpay_debt(p_payment_id uuid) RETURNS void` — ownership check via the `debts` join (else `payment_not_found`), then delete the `debt_payments` row **and** its linked expense in one transaction (direct `unpay_bill` mirror).

No changes to `handle_new_user` (no seeding).

## 3. Pure engine — `src/lib/utils/debt.ts`

No Supabase, no date-fns dependency beyond string compares; exhaustively unit-tested (mirrors `bills.ts`).

| Function | Behavior |
|---|---|
| `debtPaidOffAmount(payments: DebtPayment[]): number` | Sum of `amount` across the payments (0 for empty). |
| `debtRemaining(debt: Pick<Debt,"total_amount">, paid: number): number` | `max(0, total − paid)` — floors at 0 for display; the DB overpay guard prevents negatives, the floor is defensive. |
| `debtProgress(debt: Pick<Debt,"total_amount">, paid: number): number` | `clamp(paid / total, 0, 1)`; 0 when total is ≤ 0. |
| `isDebtPaidOff(debt: Pick<Debt,"total_amount">, paid: number): boolean` | `remaining === 0`. |
| `isDebtOverdue(debt: Pick<Debt,"total_amount"\|"due_date">, paid: number, today: string): boolean` | `paid < total AND due_date < today` (string compare, ISO `YYYY-MM-DD`). A Paid Off debt is never overdue. |

Amounts arrive from PostgREST as strings (NUMERIC-as-string) — `Number()` conversions live here and in the service, mirroring `Bill`/`BillPayment` typing.

## 4. Services — `src/lib/services/debt.service.ts` + cache

Mirrors `bills.service.ts`. RPC calls stay in the **actions** layer (exactly like `payBill`/`unpayBill`), not the service.

| Function | Behavior |
|---|---|
| `getDebts(supabase, userId): Promise<DebtView>` | `debts` ordered by `due_date` asc, plus all `debt_payments` for those debts ordered by `paid_at` asc. `DebtView = { debts: Debt[]; payments: DebtPayment[] }`. |
| `createDebt(supabase, userId, input: DebtInput): Promise<Debt>` | User-scoped insert. |
| `updateDebt(supabase, userId, id, patch): Promise<Debt>` | **Guard:** reject a new `total_amount` below the already-paid sum (`Error("TOTAL_BELOW_PAID")`) — must never push `remaining` negative. |
| `deleteDebt(supabase, userId, id): Promise<void>` | Plain scoped delete; DB cascades `debt_payments`, linked expenses survive (locked decision 7). |
| `getDebtPayment(supabase, userId, paymentId): Promise<DebtPayment \| null>` | Returns the payment row **only if** its debt is owned by the user (two scoped queries); `null` otherwise. Used by `unpayDebt` to learn `paid_at` before the RPC deletes the row, and to refuse cross-user unpay. |

Cache: add suffix `"debts"` to `FINANCIAL_TAG_SUFFIXES` in `src/lib/cache/tags.ts` (not in `USER_SCOPED_SUFFIXES` — it carries the global umbrella tag like `goals`), and `cachedGetDebts` in `src/lib/cache/shared-queries.ts` (the `cachedGetSavingsGoals` pattern). `revalidateUserFinancialCache` (already loops all suffixes) then purges debt caches on every money-visible mutation.

## 5. Actions — `src/app/(dashboard)/savings/actions.ts` + validators

Validators in `src/lib/utils/validators.ts` (mirror `billInputSchema`/`payBillSchema`/`unpayBillSchema`):

- `debtInputSchema` = `{ name (1–100), total_amount: coerce.number().positive().max(1e12).or(literal("")), due_date: string().min(1), category_id: uuid().or(literal("")), notes: max(500).or(literal("")) }`
- `payDebtSchema` = `{ debtId: uuid, paidAt: string().min(1), amount: coerce.number().positive().max(1e12), categoryId: uuid().or(literal("")), notes: max(500).or(literal("")) }`
- `unpayDebtSchema` = `{ paymentId: uuid }`

Action layer (mirrors the `addGoal`/`recordContribution` shape — `{ success }` / `{ error }`):

| Action | Behavior |
|---|---|
| `addDebt(formData)` | `createDebt`; `revalidateUserFinancialCache(user.id)`; `revalidatePath("/savings")`, `"/dashboard"`, `"/forecasting"`. |
| `editDebt(debtId, formData)` | `updateDebt`; same revalidation. Maps `TOTAL_BELOW_PAID` → "Total amount can't be less than what's already paid off." |
| `removeDebt(debtId)` | `deleteDebt`; same revalidation. (No snapshot regen — deletion keeps its expenses; the existing expenses already have snapshots.) |
| `payDebt(debtId, formData)` | **RPC `pay_debt`**; error map: `amount_exceeds_remaining` → "Payment exceeds the remaining balance." / `debt_not_found` → "Debt not found." / `amount_invalid` → "Payment amount must be greater than 0." / `category_required` → "Pick an expense category." Otherwise generic. On success: **`generateSnapshot` for `paidAt`'s month** (split `YYYY-MM-DD`) + `revalidateUserFinancialCache` + `revalidatePath` `/savings`, `/expenses`, `/dashboard`, `/budgets`, `/transactions`, `/forecasting`. |
| `unpayDebt(paymentId)` | `getDebtPayment` → if `null`, "Payment not found."; remember `paid_at`; **RPC `unpay_debt`**; on success **`generateSnapshot` for `paid_at`'s month** + the same revalidate set. |

## 6. UI — Savings page "Payoff Debts" section

- `src/app/(dashboard)/savings/page.tsx`: load `cachedGetDebts` alongside goals/categories/snapshots; pass `initialDebts` + `debtPayments` to the client. Page stays on the existing 8-nav-item structure (no `NAV_ITEMS` change).
- `savings-page-client.tsx` — new section after the Goals grid:
  - Section header: "Payoff Debts" (`CircleDollarSign` icon, rose accent) + "+ New Debt" button.
  - Empty state: "No Debts Tracked" → "Add loans, credit balances, or personal debts to track payoff progress."
  - One `FintechCard` per debt, rose/alert accenting distinct from the goals' emerald: name + due-date line (`formatDate`), **remaining** duel-display (remaining in rose, total + paid muted right-aligned), payoff `Progress` bar (value = `debtProgress × 100`), badges: **Paid Off** (`Badge variant="info"` + `Sparkles`, when `isDebtPaidOff`) and **Overdue** (`Badge variant="expense"`, calendar tint when `isDebtOverdue`) with "due {date}" copy; per-card **Payment History** list (each `paid_at` + amount with an unpay affordance) + "Make Payment" button (`HandCoins`), Edit, Delete.
  - **New Debt / Edit Debt dialog**: name*, total amount* (₱), due date* (date picker), category (the `Select` vocabulary), notes — wired to `addDebt`/`editDebt` toast results.
  - **Make Payment dialog** (the contribution-form shape already on this page): amount* (number), date* (default today), category* (`Select`, prefilled from the debt's category or the savings/emergency fallback `openContributionModal` uses), notes — wired to `payDebt`, prefilling the amount hint at the debt's remaining.
  - **Delete confirmation** (`ConfirmDialog`, wording mirrors the goal one): "This will permanently delete this debt and its payment history. Payments already logged will remain as expenses in your transactions. This action cannot be undone."
  - State derives per debt card: `paid = debtPaidOffAmount(payments.filter(p => p.debt_id === debt.id))`, then `remaining`/`progress`/`paidOff`/`overdue` from the pure helpers. No optimistic updates beyond the existing `useTransition` pending pattern.
- Debts and their payments are **automatically visible on `/transactions`** (and Budgets / Safe-to-Spend / Dashboard / Forecasting) through the linked expenses — the Q2 decision buys this with no extra work.

## 7. Edge rules

- `remaining` derived everywhere; DB overpay guard is the single source of truth; display floors at 0.
- `updateDebt` refuses `total_amount < paid_total` (service) AND the RPC guard re-checks per-payment — defense in depth against negative remaining.
- Multiple same-day payments allowed; partials to the cent.
- Paying late is allowed; overdue is display-only, derived.
- Delete keeps expenses; unpay removes a payment and its expense symmetrically.
- Paid Off is derived; row persists until deleted.

## 8. Testing

- Vitest (pure + mocked service, the `bills.ts`/`bills.service.ts` test style): `debt.ts` (zero/partial/full payoff, progress clamping, overdue boundary incl. paid-off-never-overdue), `debt.service.ts` (getDebts two-query shape, create/update-guard/delete scoping, `getDebtPayment` ownership), `validators` shape where patterns exist.
- Gates: `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`.
- Migration apply + verification (Management API against cloud project `jaaeeyeyidvekzdssqfv`): tables/columns present, RLS on, `pay_debt`/`unpay_debt` registered.
- Live CDP on production (QA account): create ₱20,000 debt due 2026-10-30 → pay ₱5,000 → expense row on `/transactions` + Budgets/Safe-to-Spend/Dashboard reflect it + progress 25% → **snapshot regenerated** (query `monthly_snapshots` via Management API) → overpay toast rejected → unpay removes expense + restores balance → full payoff shows **Paid Off** → delete debt keeps the expenses → reconnect to `/savings` and confirm the section/empty state.

## 9. Explicitly untouched / deferred

- `financial.service`, `forecast.service`, `snapshot.service`, budget services, Health Score math, `safe-to-spend.service` internals, `reminders` semantics, `NAV_ITEMS`, `savings_goals` table and its trigger, migration 001/008, `handle_new_user`.
- Deferred: debt-due-date notifications, historical snapshot backfill (Bundled K2 fix), account/wallet allocation (separate feature), interest/amortization, Debt cards bleeding into the Income tab.