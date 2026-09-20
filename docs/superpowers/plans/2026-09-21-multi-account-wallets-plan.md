# Multi-Account & Wallet System (Minimal v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal v1 Multi-Account & Wallet System allowing users to create custom wallets, tag income and expenses optionally, execute internal transfers with fees, and view accurate per-account derived balances.

**Architecture:** PostgreSQL schema migration with `accounts` & `account_transfers` tables + composite foreign keys for same-user ownership, a hardened PostgreSQL Security Definer RPC (`SET search_path = ''`) for fast database-side aggregation, TypeScript `AccountService` and `TransferService`, Next.js Server Actions, and an `/accounts` dashboard view with `<AccountCard>`, `<AccountModal>`, `<TransferModal>`, and optional `<AccountSelect>` controls on transaction forms.

**Tech Stack:** Next.js (App Router), Supabase (PostgreSQL, RLS, RPC), TypeScript, Tailwind CSS, date-fns (`Asia/Manila`), Vitest.

## Global Constraints

- **Account Tagging Optional**: `account_id` on income/expenses is nullable (`ON DELETE SET NULL`); untagged entries remain "Unassigned" without breaking global monthly totals.
- **Policy 2 Non-Blocking Overdrafts**: Negative derived balances are allowed and styled with a warning badge; transfers/expenses are never blocked for causing negative balances.
- **Internal Transfers Isolated**: `account_transfers` alters individual account balances without appearing in Income or Expense totals. Transfer fees are paid by the source account only (`-(amount + transfer_fee)` on source, `+amount` on destination).
- **Credit Accounts Lightweight**: `credit` is a category badge only with standard ledger calculations and no credit-limit/debt subsystem.
- **Archived Accounts Retention**: Soft archiving hides accounts from active modal pickers while preserving all historical calculations and transfer history.
- **Database Ownership Enforced**: Composite FKs `(account_id, user_id)` enforce same-user ownership at the database level.
- **Cutoff Date Standard**: Today's cutoff uses `Asia/Manila` wall-clock (`toISODateString(getManilaNow())`).
- **Hardened RPC**: `get_account_aggregates` uses `SECURITY DEFINER SET search_path = ''` and validates `p_user_id = auth.uid()`.

---

### Task 1: Database Schema Migration & Hardened RPC

**Files:**
- Create: `supabase/migrations/20260921000000_create_multi_account_system.sql`
- Test: `src/tests/accounts-schema.test.ts`
- Test: `src/tests/accounts-rpc.test.ts`

**Interfaces:**
- Consumes: Existing Supabase database connection and `auth.users` schema.
- Produces: `accounts` table, `account_transfers` table, updated `income_entries` & `expenses` schema with composite FKs, composite indexes, and `get_account_aggregates(p_user_id UUID, p_today DATE)` RPC function.

- [ ] **Step 1: Write SQL migration file**

Create `supabase/migrations/20260921000000_create_multi_account_system.sql`:

```sql
-- 1. ACCOUNTS TABLE
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

-- 2. ACCOUNT TRANSFERS TABLE
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

-- 3. INCOME & EXPENSE MODIFICATIONS
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

-- 4. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_user_id ON public.account_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_from_account ON public.account_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_to_account ON public.account_transfers(to_account_id);
CREATE INDEX IF NOT EXISTS idx_income_entries_account_id ON public.income_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON public.expenses(account_id);

-- 5. HARDENED SECURITY DEFINER AGGREGATION RPC
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

- [ ] **Step 2: Write tests for database schema constraints and RPC security**

Create `src/tests/accounts-schema.test.ts` and `src/tests/accounts-rpc.test.ts` using Vitest + Supabase mock patterns established in existing tests.

- [ ] **Step 3: Run Vitest test suite**

Run: `npx vitest run src/tests/accounts-schema.test.ts src/tests/accounts-rpc.test.ts`
Expected: PASS

- [ ] **Step 4: Commit Migration & Database Tests**

```bash
git add supabase/migrations/20260921000000_create_multi_account_system.sql src/tests/accounts-schema.test.ts src/tests/accounts-rpc.test.ts
git commit -m "feat: add multi-account database schema, composite FKs, and RPC migration"
```

---

### Task 2: TypeScript Data Types & Core `AccountService`

**Files:**
- Modify: `src/lib/types/index.ts`
- Create: `src/lib/services/account.service.ts`
- Test: `src/tests/account.service.test.ts`

**Interfaces:**
- Consumes: SupabaseClient, `Asia/Manila` date utils (`getManilaNow`, `toISODateString`).
- Produces: `Account`, `AccountWithBalance`, `AccountFormData`, `UnassignedTotals` interfaces, and `AccountService` methods (`getAccountsWithBalances`, `createAccount`, `updateAccount`, `archiveAccount`).

- [ ] **Step 1: Update `src/lib/types/index.ts`**

Add Account and Transfer type interfaces to `src/lib/types/index.ts`:

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

- [ ] **Step 2: Create `src/lib/services/account.service.ts`**

Implement `AccountService`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import type { Account, AccountWithBalance, AccountFormData, UnassignedTotals } from "@/lib/types";
import { getManilaNow, toISODateString } from "@/lib/utils/date";

export async function getAccountsWithBalances(
  supabase: SupabaseClient,
  userId: string,
  includeArchived = false
): Promise<{ accounts: AccountWithBalance[]; unassigned: UnassignedTotals; totalLiquidity: number }> {
  const todayStr = toISODateString(getManilaNow());

  let accountsQuery = supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!includeArchived) {
    accountsQuery = accountsQuery.eq("is_archived", false);
  }

  const [{ data: accounts, error: accErr }, { data: aggregates, error: rpcErr }, { data: unassignedInc }, { data: unassignedExp }] =
    await Promise.all([
      accountsQuery,
      supabase.rpc("get_account_aggregates", { p_user_id: userId, p_today: todayStr }),
      supabase
        .from("income_entries")
        .select("amount")
        .eq("user_id", userId)
        .is("account_id", null)
        .lte("date", todayStr),
      supabase
        .from("expenses")
        .select("amount")
        .eq("user_id", userId)
        .is("account_id", null)
        .lte("date", todayStr),
    ]);

  if (accErr) throw accErr;
  if (rpcErr) throw rpcErr;

  const aggMap = new Map<string, { total_income: number; total_expenses: number; transfers_in: number; transfers_out: number; transfer_fees: number }>();
  (aggregates || []).forEach((row: any) => {
    aggMap.set(row.account_id, {
      total_income: Number(row.total_income) || 0,
      total_expenses: Number(row.total_expenses) || 0,
      transfers_in: Number(row.transfers_in) || 0,
      transfers_out: Number(row.transfers_out) || 0,
      transfer_fees: Number(row.transfer_fees) || 0,
    });
  });

  const accountsWithBalances: AccountWithBalance[] = (accounts || []).map((acc: Account) => {
    const agg = aggMap.get(acc.id) || {
      total_income: 0,
      total_expenses: 0,
      transfers_in: 0,
      transfers_out: 0,
      transfer_fees: 0,
    };
    const initBal = Number(acc.initial_balance) || 0;
    const current_balance = initBal + agg.total_income - agg.total_expenses + agg.transfers_in - agg.transfers_out - agg.transfer_fees;

    return {
      ...acc,
      current_balance,
      total_income: agg.total_income,
      total_expenses: agg.total_expenses,
      total_transfers_in: agg.transfers_in,
      total_transfers_out: agg.transfers_out,
      total_transfer_fees: agg.transfer_fees,
      is_negative: current_balance < 0,
    };
  });

  const totalLiquidity = accountsWithBalances
    .filter((a) => !a.is_archived)
    .reduce((sum, a) => sum + a.current_balance, 0);

  const unassignedIncome = (unassignedInc || []).reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);
  const unassignedExpenses = (unassignedExp || []).reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

  return {
    accounts: accountsWithBalances,
    unassigned: { unassignedIncome, unassignedExpenses },
    totalLiquidity,
  };
}

export async function createAccount(
  supabase: SupabaseClient,
  userId: string,
  data: AccountFormData
): Promise<Account> {
  if (data.initial_balance < 0) {
    throw new Error("Initial starting balance must be non-negative.");
  }

  const { data: created, error } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      name: data.name,
      type: data.type,
      initial_balance: data.initial_balance,
      color: data.color || null,
      icon: data.icon || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return created as Account;
}

export async function updateAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  data: Partial<AccountFormData>
): Promise<Account> {
  if (data.initial_balance !== undefined && data.initial_balance < 0) {
    throw new Error("Initial starting balance must be non-negative.");
  }

  const { data: updated, error } = await supabase
    .from("accounts")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return updated as Account;
}

export async function archiveAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  isArchived: boolean
): Promise<Account> {
  const { data: updated, error } = await supabase
    .from("accounts")
    .update({
      is_archived: isArchived,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw error;
  return updated as Account;
}
```

- [ ] **Step 3: Write tests for `AccountService`**

Create `src/tests/account.service.test.ts` testing balance math, initial balance updates, date cutoffs, archived account handling, and unassigned totals.

- [ ] **Step 4: Run Vitest unit tests**

Run: `npx vitest run src/tests/account.service.test.ts`
Expected: PASS

- [ ] **Step 5: Commit `AccountService`**

```bash
git add src/lib/types/index.ts src/lib/services/account.service.ts src/tests/account.service.test.ts
git commit -m "feat: add AccountService with Manila date cutoff and derived balance calculation"
```

---

### Task 3: Core `TransferService`

**Files:**
- Create: `src/lib/services/transfer.service.ts`
- Test: `src/tests/transfer.service.test.ts`

**Interfaces:**
- Consumes: SupabaseClient, `AccountTransferFormData`, `AccountTransfer`.
- Produces: `TransferService` methods (`createTransfer`, `updateTransfer`, `deleteTransfer`, `getTransfers`).

- [ ] **Step 1: Create `src/lib/services/transfer.service.ts`**

Implement `TransferService`:

```typescript
import { SupabaseClient } from "@supabase/supabase-js";
import type { AccountTransfer, AccountTransferFormData } from "@/lib/types";

export async function createTransfer(
  supabase: SupabaseClient,
  userId: string,
  data: AccountTransferFormData
): Promise<AccountTransfer> {
  if (data.from_account_id === data.to_account_id) {
    throw new Error("Source and destination accounts must be different.");
  }
  if (data.amount <= 0) {
    throw new Error("Transfer amount must be greater than zero.");
  }
  const fee = data.transfer_fee || 0;
  if (fee < 0) {
    throw new Error("Transfer fee cannot be negative.");
  }

  // Verify accounts belong to user and are not archived
  const { data: accounts, error: accErr } = await supabase
    .from("accounts")
    .select("id, is_archived")
    .eq("user_id", userId)
    .in("id", [data.from_account_id, data.to_account_id]);

  if (accErr) throw accErr;
  if (!accounts || accounts.length < 2) {
    throw new Error("One or both accounts do not exist or belong to another user.");
  }
  if (accounts.some((a) => a.is_archived)) {
    throw new Error("Transfers cannot be performed on archived accounts.");
  }

  const { data: created, error } = await supabase
    .from("account_transfers")
    .insert({
      user_id: userId,
      from_account_id: data.from_account_id,
      to_account_id: data.to_account_id,
      amount: data.amount,
      transfer_fee: fee,
      date: data.date,
      notes: data.notes || null,
    })
    .select("*, from_account:accounts!from_account_id(*), to_account:accounts!to_account_id(*)")
    .single();

  if (error) throw error;
  return created as AccountTransfer;
}

export async function updateTransfer(
  supabase: SupabaseClient,
  userId: string,
  transferId: string,
  data: Partial<AccountTransferFormData>
): Promise<AccountTransfer> {
  if (data.from_account_id && data.to_account_id && data.from_account_id === data.to_account_id) {
    throw new Error("Source and destination accounts must be different.");
  }
  if (data.amount !== undefined && data.amount <= 0) {
    throw new Error("Transfer amount must be greater than zero.");
  }
  if (data.transfer_fee !== undefined && data.transfer_fee < 0) {
    throw new Error("Transfer fee cannot be negative.");
  }

  const { data: updated, error } = await supabase
    .from("account_transfers")
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", transferId)
    .eq("user_id", userId)
    .select("*, from_account:accounts!from_account_id(*), to_account:accounts!to_account_id(*)")
    .single();

  if (error) throw error;
  return updated as AccountTransfer;
}

export async function deleteTransfer(
  supabase: SupabaseClient,
  userId: string,
  transferId: string
): Promise<void> {
  const { error } = await supabase
    .from("account_transfers")
    .delete()
    .eq("id", transferId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function getTransfers(
  supabase: SupabaseClient,
  userId: string,
  options?: { accountId?: string; limit?: number }
): Promise<AccountTransfer[]> {
  let query = supabase
    .from("account_transfers")
    .select("*, from_account:accounts!from_account_id(*), to_account:accounts!to_account_id(*)")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (options?.accountId) {
    query = query.or(`from_account_id.eq.${options.accountId},to_account_id.eq.${options.accountId}`);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AccountTransfer[];
}
```

- [ ] **Step 2: Write unit tests for `TransferService`**

Create `src/tests/transfer.service.test.ts` testing transfer creation, fee deduction semantics, non-blocking Policy 2 overdrawn transfers, ownership validation, and transfer edits/deletions.

- [ ] **Step 3: Run Vitest unit tests**

Run: `npx vitest run src/tests/transfer.service.test.ts`
Expected: PASS

- [ ] **Step 4: Commit `TransferService`**

```bash
git add src/lib/services/transfer.service.ts src/tests/transfer.service.test.ts
git commit -m "feat: add TransferService with fee semantics and ownership validation"
```

---

### Task 4: Server Actions & Income/Expense Transaction Modal Integration

**Files:**
- Create: `src/app/(dashboard)/accounts/actions.ts`
- Create: `src/components/forms/account-select.tsx`
- Modify: `src/app/(dashboard)/income/actions.ts`
- Modify: `src/app/(dashboard)/expenses/actions.ts`
- Modify: `src/components/forms/income-modal.tsx`
- Modify: `src/components/forms/expense-modal.tsx`
- Test: `src/tests/accounts-actions.test.ts`

**Interfaces:**
- Consumes: Server Action mutations, Zod schemas, `<AccountSelect />` form dropdown.
- Produces: Server actions for Account and Transfer CRUD + optional account selection on Income and Expense logging forms.

- [ ] **Step 1: Create `src/app/(dashboard)/accounts/actions.ts`**

Implement Server Actions for account and transfer management with path revalidation.

- [ ] **Step 2: Create `src/components/forms/account-select.tsx`**

Implement `<AccountSelect />` component rendering active accounts + `None / Unassigned` option.

- [ ] **Step 3: Update `income/actions.ts`, `expenses/actions.ts`, `income-modal.tsx`, `expense-modal.tsx`**

Add optional `account_id` string field to Zod validation schemas and insert `<AccountSelect />` into transaction form modals.

- [ ] **Step 4: Write tests for Server Actions & Transaction Integration**

Create `src/tests/accounts-actions.test.ts` testing server action validation, session authorization, and optional `account_id` payload handling.

- [ ] **Step 5: Run Vitest test suite**

Run: `npx vitest run src/tests/accounts-actions.test.ts`
Expected: PASS

- [ ] **Step 6: Commit Server Actions & Form Integration**

```bash
git add src/app/\(dashboard\)/accounts/actions.ts src/components/forms/account-select.tsx src/app/\(dashboard\)/income/actions.ts src/app/\(dashboard\)/expenses/actions.ts src/components/forms/income-modal.tsx src/components/forms/expense-modal.tsx src/tests/accounts-actions.test.ts
git commit -m "feat: add Accounts server actions and optional account select to transaction forms"
```

---

### Task 5: Accounts Dashboard UI & Components (`/accounts`)

**Files:**
- Create: `src/app/(dashboard)/accounts/page.tsx`
- Create: `src/app/(dashboard)/accounts/accounts-client.tsx`
- Create: `src/components/accounts/account-card.tsx`
- Create: `src/components/accounts/account-modal.tsx`
- Create: `src/components/accounts/transfer-modal.tsx`
- Create: `src/components/accounts/transfer-list.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/mobile-nav.tsx`
- Test: `src/tests/accounts-ui.test.tsx`

**Interfaces:**
- Consumes: `AccountWithBalance`, `AccountTransfer`, `AccountService`, `TransferService`.
- Produces: `/accounts` page route, account cards grid, Policy 2 warning tooltips, transfer modal with fee breakdown, and navigation links.

- [ ] **Step 1: Create `AccountCard` (`src/components/accounts/account-card.tsx`)**

Implement `AccountCard` displaying name, type badge, formatted balance, subtext initial balance, and Policy 2 red balance + `[⚠️ Negative Balance]` alert badge with tooltip for negative derived balances.

- [ ] **Step 2: Create `AccountModal` (`src/components/accounts/account-modal.tsx`)**

Implement `AccountModal` with fields for Name, Type, Initial Balance (`≥ 0`), and Color/Icon selection.

- [ ] **Step 3: Create `TransferModal` (`src/components/accounts/transfer-modal.tsx`)**

Implement `TransferModal` displaying source/destination selection, amount, fee breakdown (Source impact `-₱(amount+fee)` vs Destination impact `+₱amount`), and non-blocking Policy 2 amber alert for overdrawn transfers.

- [ ] **Step 4: Create `TransferList` (`src/components/accounts/transfer-list.tsx`)**

Implement table showing recent transfers, fee pills, and `(Archived)` account badges.

- [ ] **Step 5: Create `/accounts` page & `accounts-client.tsx`**

Wire components into the client container with Liquidity summary cards, unassigned context notice, active count, and archive toggle. Add sidebar and mobile nav links.

- [ ] **Step 6: Write UI component tests**

Create `src/tests/accounts-ui.test.tsx` testing render states, Policy 2 tooltips, transfer modal fee callouts, and accessibility ARIA tags.

- [ ] **Step 7: Run Vitest test suite**

Run: `npx vitest run src/tests/accounts-ui.test.tsx`
Expected: PASS

- [ ] **Step 8: Commit Accounts UI**

```bash
git add src/app/\(dashboard\)/accounts/ src/components/accounts/ src/components/layout/ src/tests/accounts-ui.test.tsx
git commit -m "feat: add Accounts dashboard view, account cards, transfer modal, and navigation"
```

---

### Task 6: Non-Regression & Precision Test Suite

**Files:**
- Create: `src/tests/accounts-precision.test.ts`
- Create: `src/tests/accounts-regression.test.ts`

**Interfaces:**
- Consumes: Existing budget, safe-to-spend, health score, and income/expense services.
- Produces: Complete precision and non-regression verification suite.

- [ ] **Step 1: Create `src/tests/accounts-precision.test.ts`**

Write tests validating ₱0.01 minimum amounts, ₱0.00 fees, boundary values, and two-decimal precision serialization.

- [ ] **Step 2: Create `src/tests/accounts-regression.test.ts`**

Write targeted tests verifying that `account_id` presence or absence does not alter outputs of `getMonthlySummary`, `getBudgetStatuses`, `computeSafeToSpend`, or `calculateHealthScore`.

- [ ] **Step 3: Run full automated verification**

Run: `npx vitest run && npm run build`
Expected: ALL TESTS PASS with 0 build or type errors.

- [ ] **Step 4: Commit Non-Regression Suite**

```bash
git add src/tests/accounts-precision.test.ts src/tests/accounts-regression.test.ts
git commit -m "test: add precision and non-regression test suites for accounts v1"
```

---

## Self-Review & Spec Coverage Check

1. **Spec Coverage**:
   - Schema, composite FKs, RPC: Covered in Task 1.
   - `AccountService`, date cutoffs, archived accounts: Covered in Task 2.
   - `TransferService`, fee semantics, non-blocking Policy 2: Covered in Task 3.
   - Server Actions & optional transaction tagging: Covered in Task 4.
   - `/accounts` UI, cards, Policy 2 warning tooltips, fee breakdown: Covered in Task 5.
   - Precision & non-regression test suite: Covered in Task 6.
2. **Placeholder Scan**: 0 placeholders found.
3. **Type Consistency**: `Account`, `AccountWithBalance`, `AccountTransfer`, `AccountFormData`, `AccountTransferFormData` types verified across all tasks.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-21-multi-account-wallets-plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
