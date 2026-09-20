# Multi-Account & Wallet System (Minimal v1) — Design Specification

**Date**: September 21, 2026  
**Status**: APPROVED & LOCKED 🔒  
**Scope**: Minimal v1 Account Ledger, Optional Entry Tagging, Internal Transfers, and Balance Visualization.

---

## 1. Architecture & Database Schema

### 1.1 `accounts` Table

Stores user-defined wallets, bank accounts, cash reserves, and digital accounts.

```sql
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bank', 'ewallet', 'cash', 'digital_bank', 'credit')),
  initial_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (initial_balance >= 0),
  color TEXT,
  icon TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT accounts_id_user_id_key UNIQUE (id, user_id)
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own accounts"
  ON public.accounts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 1.2 `account_transfers` Table

Stores internal money movements between user accounts without altering income/expense cashflow aggregates.

```sql
CREATE TABLE IF NOT EXISTS public.account_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_account_id UUID NOT NULL,
  to_account_id UUID NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  transfer_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (transfer_fee >= 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_account_id <> to_account_id),
  CONSTRAINT fk_transfers_from_account 
    FOREIGN KEY (from_account_id, user_id) 
    REFERENCES public.accounts(id, user_id) 
    ON DELETE RESTRICT,
  CONSTRAINT fk_transfers_to_account 
    FOREIGN KEY (to_account_id, user_id) 
    REFERENCES public.accounts(id, user_id) 
    ON DELETE RESTRICT
);

ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own transfers"
  ON public.account_transfers
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 1.3 `income_entries` and `expenses` Modifications

Add optional `account_id` foreign key columns to existing transaction tables using composite foreign keys on `(account_id, user_id)` to guarantee database-level same-user ownership.

```sql
ALTER TABLE public.income_entries
  ADD COLUMN IF NOT EXISTS account_id UUID,
  ADD CONSTRAINT fk_income_entries_account 
    FOREIGN KEY (account_id, user_id) 
    REFERENCES public.accounts(id, user_id) 
    ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS account_id UUID,
  ADD CONSTRAINT fk_expenses_account 
    FOREIGN KEY (account_id, user_id) 
    REFERENCES public.accounts(id, user_id) 
    ON DELETE SET NULL;
```

### 1.4 Database Performance Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_user_id ON public.account_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_from_account ON public.account_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_to_account ON public.account_transfers(to_account_id);
CREATE INDEX IF NOT EXISTS idx_income_entries_account_id ON public.income_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON public.expenses(account_id);
```

### 1.5 Architecture Decisions & Constraints

1. **Transfer & Entry Ownership Integrity**: Composite FKs `(from_account_id, user_id)`, `(to_account_id, user_id)`, and `(account_id, user_id)` guarantee at the database schema level that referenced accounts belong to the exact same `user_id`.
2. **Initial Balance**: `initial_balance` is constrained `CHECK (initial_balance >= 0)`.
3. **Transfer Fee Semantics**: Transfer from Account A to Account B for `amount` with `transfer_fee`:
   - Account A (Source) delta: `-(amount + transfer_fee)`
   - Account B (Destination) delta: `+amount`
   - `transfer_fee` is paid exclusively by the source account and does NOT become an Income or Expense record.
4. **`credit` Account Type Scope**: `credit` is a categorization/type label only. It has no special credit or debt behavior in v1. Its balance is calculated using the same generic account formula as other account types.
5. **Financial History Preservation**: `ON DELETE RESTRICT` on transfers prevents hard-deleting accounts with transfer history. Account management relies on soft archiving (`is_archived = TRUE`). Transaction deletion uses `ON DELETE SET NULL`.
6. **`updated_at` Timestamp Convention**: Service methods pass `updated_at: new Date().toISOString()` during updates, matching MoneyMapPH's existing service pattern (`debt.service.ts`, `bills.service.ts`, `reminder.service.ts`).

---

## 2. Data Flow & Service Layer

### 2.1 TypeScript Types (`src/lib/types/index.ts`)

```typescript
export type AccountType = "bank" | "ewallet" | "cash" | "digital_bank" | "credit";

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  initial_balance: number;
  color: string | null;
  icon: string | null;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AccountWithBalance extends Account {
  current_balance: number;
  total_income: number;
  total_expenses: number;
  total_transfers_in: number;
  total_transfers_out: number;
  total_transfer_fees: number;
  is_negative: boolean;
}

export interface AccountTransfer {
  id: string;
  user_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_fee: number;
  date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  from_account?: Account;
  to_account?: Account;
}

export interface AccountFormData {
  name: string;
  type: AccountType;
  initial_balance: number;
  color?: string;
  icon?: string;
}

export interface AccountTransferFormData {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_fee?: number;
  date: string;
  notes?: string;
}

export interface UnassignedTotals {
  unassignedIncome: number;
  unassignedExpenses: number;
}
```

### 2.2 Timezone & Date Cutoff Rules

- **Timezone Standard**: Today's cutoff date string (`todayStr`) is generated using `toISODateString(getManilaNow())` (`Asia/Manila` UTC+8 wall clock).
- **Current Balance Cutoff Rule**: `current_balance` incorporates all recorded transactions where `date <= todayStr`. Post-dated entries (`date > todayStr`) are excluded.
- **Unassigned Totals Date Consistency**: `unassignedIncome` and `unassignedExpenses` are calculated using the exact same cutoff filter (`date <= todayStr`).

### 2.3 Hardened SECURITY DEFINER RPC

```sql
CREATE OR REPLACE FUNCTION public.get_account_aggregates(p_user_id UUID, p_today DATE)
RETURNS TABLE (
  account_id UUID,
  total_income NUMERIC,
  total_expenses NUMERIC,
  transfers_in NUMERIC,
  transfers_out NUMERIC,
  transfer_fees NUMERIC
) 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL OR auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized database function access';
  END IF;

  RETURN QUERY
  WITH 
  inc AS (
    SELECT e.account_id, SUM(e.amount) AS total_income
    FROM public.income_entries e
    WHERE e.user_id = p_user_id AND e.account_id IS NOT NULL AND e.date <= p_today
    GROUP BY e.account_id
  ),
  exp AS (
    SELECT x.account_id, SUM(x.amount) AS total_expenses
    FROM public.expenses x
    WHERE x.user_id = p_user_id AND x.account_id IS NOT NULL AND x.date <= p_today
    GROUP BY x.account_id
  ),
  t_out AS (
    SELECT t.from_account_id AS account_id, SUM(t.amount) AS transfers_out, SUM(t.transfer_fee) AS transfer_fees
    FROM public.account_transfers t
    WHERE t.user_id = p_user_id AND t.date <= p_today
    GROUP BY t.from_account_id
  ),
  t_in AS (
    SELECT t.to_account_id AS account_id, SUM(t.amount) AS transfers_in
    FROM public.account_transfers t
    WHERE t.user_id = p_user_id AND t.date <= p_today
    GROUP BY t.to_account_id
  ),
  all_acc_ids AS (
    SELECT inc.account_id FROM inc
    UNION SELECT exp.account_id FROM exp
    UNION SELECT t_out.account_id FROM t_out
    UNION SELECT t_in.account_id FROM t_in
  )
  SELECT 
    a.account_id,
    COALESCE(inc.total_income, 0) AS total_income,
    COALESCE(exp.total_expenses, 0) AS total_expenses,
    COALESCE(t_in.transfers_in, 0) AS transfers_in,
    COALESCE(t_out.transfers_out, 0) AS transfers_out,
    COALESCE(t_out.transfer_fees, 0) AS transfer_fees
  FROM all_acc_ids a
  LEFT JOIN inc ON inc.account_id = a.account_id
  LEFT JOIN exp ON exp.account_id = a.account_id
  LEFT JOIN t_out ON t_out.account_id = a.account_id
  LEFT JOIN t_in ON t_in.account_id = a.account_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_account_aggregates(UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_account_aggregates(UUID, DATE) TO authenticated;
```

### 2.4 Service & Server Action Layer

1. **`AccountService` (`src/lib/services/account.service.ts`)**:
   - `getAccountsWithBalances(supabase, userId, includeArchived = false)`: Fetches accounts, calls `get_account_aggregates` RPC for `todayStr`, computes `current_balance = initial_balance + income - expenses + transfers_in - transfers_out - transfer_fees`, flags `is_negative = current_balance < 0`, and calculates unassigned totals.
   - `createAccount`, `updateAccount`, `archiveAccount`: Scoped CRUD operations (passing `updated_at: new Date().toISOString()`).
2. **`TransferService` (`src/lib/services/transfer.service.ts`)**:
   - `createTransfer`, `updateTransfer`, `deleteTransfer`: Validates account ownership and parameters (`from_account_id !== to_account_id`, `amount > 0`, `transfer_fee >= 0`, neither account is archived). Under **Policy 2**, does NOT block transfers that result in a negative derived balance. Updates include `updated_at: new Date().toISOString()`.
3. **Server Actions (`src/app/(dashboard)/accounts/actions.ts`)**:
   - Exposes mutations with Zod schema validation, session authentication checks (`auth.uid()`), and path revalidation (`/accounts`, `/dashboard`, `/transactions`).

---

## 3. User Interface & Components

### 3.1 Page & Layout Structure (`src/app/(dashboard)/accounts/`)

- **Route**: `src/app/(dashboard)/accounts/page.tsx`
- **Header**: Title ("Accounts & Wallets"), Subtitle, `[+ New Account]` button, `[↔ Transfer Money]` button.
- **Liquidity Summary Cards**:
  1. **Total Tracked Liquidity**: Sum of non-archived account balances.
  2. **Unassigned Context Card**: Count and net total of untagged entries with note: *"Untagged transactions continue to be included in your monthly totals, budgets, and financial metrics."*
  3. **Active Count & Archive Toggle**: Shows active count and `[ ] Show Archived Accounts` checkbox.

### 3.2 Key Components

1. **`AccountCard` (`src/components/accounts/account-card.tsx`)**:
   - Displays Icon, Name, Type badge (`Bank`, `E-Wallet`, `Cash`, `Digital Bank`, `Credit`).
   - Normal Balance: Bold text (`₱12,450.00`).
   - Policy 2 Negative Balance (< ₱0.00): Red text (`-₱1,250.00`), `[⚠️ Negative Balance]` alert badge, and tooltip:  
     *"This is a derived balance based on the starting balance and transactions assigned to this account. It can become negative when recorded outflows exceed the recorded starting balance and inflows. Because account tagging is optional, the derived balance may not represent the actual external account balance."*
2. **`AccountModal` (`src/components/accounts/account-modal.tsx`)**:
   - Form fields: Name, Type dropdown, Initial Balance (`initial_balance >= 0`), Color/Icon picker.
3. **`TransferModal` (`src/components/accounts/transfer-modal.tsx`)**:
   - Form fields: From Account, To Account, Amount, Transfer Fee (default ₱0.00), Date, Notes.
   - Fee breakdown: Transfer amount: `₱2,000.00` | Fee: `₱15.00` | Source impact: `-₱2,015.00` | Destination impact: `+₱2,000.00`.
   - Policy 2 Non-Blocking Alert: For `date <= todayStr`, if source balance would become negative, displays amber warning callout while keeping `[Confirm Transfer]` button active.
4. **`TransferList` (`src/components/accounts/transfer-list.tsx`)**:
   - Table displaying historical transfers. Transfers involving archived accounts remain visible with a `(Archived)` label.
5. **`AccountSelect` (`src/components/forms/account-select.tsx`)**:
   - Optional dropdown added to Income & Expense modals (`None / Unassigned` default).

---

## 4. Verification Plan & Test Strategy

### 4.1 Test Suites

1. **Database & Schema Isolation Tests (`src/tests/accounts-schema.test.ts`)**:
   - SELECT, INSERT, UPDATE, DELETE RLS isolation for accounts and transfers.
   - DB constraints (`initial_balance >= 0`, `amount > 0`, `transfer_fee >= 0`, composite FKs on transfers and income/expenses, `ON DELETE RESTRICT`, `ON DELETE SET NULL`).
2. **RPC & Security Tests (`src/tests/accounts-rpc.test.ts`)**:
   - Verifies `SET search_path = ''` RPC authorization, session ID checks, anonymous rejection, and `Asia/Manila` date filter.
3. **Service Layer & Balance Calculation Tests (`src/tests/account-service.test.ts`)**:
   - Derived balance formula, metadata updates, initial balance adjustments, Policy 2 negative balance handling, and archived account retention.
4. **Transfer Mutation & Policy 2 Tests (`src/tests/transfer-service.test.ts`)**:
   - Ownership checks, active account validation, non-blocking overdrawn transfers, transfer edits/deletions balance recalculation, and transfer date change logic.
5. **Server Action & Validation Tests (`src/tests/accounts-actions.test.ts`)**:
   - Session authentication verification, Zod input validation, and cross-user mutation protection.
6. **Precision & Monetary Handling (`src/tests/accounts-precision.test.ts`)**:
   - Verifies `NUMERIC(12,2)` precision, minimum values (₱0.01), and compatibility with existing MoneyMapPH money utilities.
7. **Non-Regression Suite (`src/tests/accounts-regression.test.ts`)**:
   - Validates that adding `account_id` (NULL or populated) produces zero changes in Dashboard, Income, Expenses, Budgets, Safe-to-Spend, and Health Score metrics.
8. **Automated Verification Execution**: `npm run test` and `npm run build`.

### 4.2 Acceptance Criteria Matrix

| Requirement | Verification Method | Expected Result |
| :--- | :--- | :--- |
| **Optional Account Tagging** | `Income/Expense Action Test` | Form submits with `account_id = null`; no errors thrown; global totals updated. |
| **Database Ownership Integrity** | `Composite FK Schema Test` | Cross-user transfer and transaction account assignment blocked at database schema level. |
| **Hardened Aggregation RPC** | `RPC Security Test` | Caller ID mismatch throws exception; execution returns compact user-scoped aggregates (`SET search_path = ''`). |
| **Policy 2 Non-Blocking Warnings** | `Transfer & UI Test` | Overdrawn account permits transfer execution; UI displays negative balance warning badge. |
| **Transfer Fee Accounting** | `Transfer Calculation Test` | Source account debited `amount + fee`; Destination account credited `amount`; Fees excluded from Income/Expense totals. |
| **Archived Account Retention** | `Account Archiving Test` | Account hidden from active pickers; historical calculations and transfer history preserved intact. |
| **Manila Date Cutoff** | `Date Cutoff Test` | Entries with `date <= todayStr` (`Asia/Manila`) included in `current_balance`; post-dated entries excluded. |
| **Non-Regression** | `Regression Test Suite` | Existing Budgets, Safe-to-Spend, and Health Score metrics produce identical output before and after Accounts migration. |
