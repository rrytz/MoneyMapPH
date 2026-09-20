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
