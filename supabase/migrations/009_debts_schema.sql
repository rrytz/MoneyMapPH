-- ============================================================
-- DEBTS SCHEMA (negative goals)
-- Tables, RLS, RPCs. No seeding — debts are wholly user-created.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  due_date DATE NOT NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debts_user ON public.debts(user_id);
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own debts" ON public.debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debts" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON public.debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON public.debts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  paid_at DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (expense_id)
);

CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON public.debt_payments(debt_id, paid_at);
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own debt payments" ON public.debt_payments
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));
CREATE POLICY "Users can insert own debt payments" ON public.debt_payments
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));
CREATE POLICY "Users can update own debt payments" ON public.debt_payments
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));
CREATE POLICY "Users can delete own debt payments" ON public.debt_payments
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.debts WHERE debts.id = debt_payments.debt_id AND debts.user_id = auth.uid()));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.debt_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------
-- RPC: pay_debt — log an expense + payment atomically, with an
-- overpay guard computed inside the transaction (FOR UPDATE).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_debt(
  p_debt_id uuid,
  p_paid_at date,
  p_category_id uuid,
  p_amount numeric,
  p_notes text DEFAULT NULL
) RETURNS public.debt_payments
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_debt public.debts%ROWTYPE;
  v_remaining numeric;
  v_expense_id uuid;
  v_result public.debt_payments%ROWTYPE;
  v_resolved_category_id uuid;
BEGIN
  SELECT * INTO v_debt FROM public.debts WHERE id = p_debt_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'debt_not_found'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount_invalid'; END IF;

  v_remaining := v_debt.total_amount - COALESCE(
    (SELECT SUM(amount) FROM public.debt_payments WHERE debt_id = p_debt_id), 0
  );
  IF p_amount > v_remaining THEN RAISE EXCEPTION 'amount_exceeds_remaining'; END IF;

  v_resolved_category_id := COALESCE(
    p_category_id,
    v_debt.category_id,
    (SELECT id FROM public.expense_categories ec
      WHERE ec.user_id = auth.uid() AND ec.is_default
      ORDER BY ec.sort_order, ec.id LIMIT 1)
  );
  IF v_resolved_category_id IS NULL THEN
    RAISE EXCEPTION 'category_required';
  END IF;

  INSERT INTO public.expenses (user_id, title, amount, category_id, date, notes)
  VALUES (auth.uid(), v_debt.name, p_amount, v_resolved_category_id, p_paid_at, p_notes)
  RETURNING id INTO v_expense_id;

  INSERT INTO public.debt_payments (debt_id, paid_at, amount, expense_id)
  VALUES (p_debt_id, p_paid_at, p_amount, v_expense_id)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- ------------------------------------------------------------
-- RPC: unpay_debt — remove payment AND its linked expense atomically
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unpay_debt(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_expense_id uuid;
  v_owned boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.debt_payments dp
    JOIN public.debts d ON d.id = dp.debt_id
    WHERE dp.id = p_payment_id AND d.user_id = auth.uid()
  ) INTO v_owned;
  IF NOT v_owned THEN RAISE EXCEPTION 'payment_not_found'; END IF;

  SELECT expense_id INTO v_expense_id FROM public.debt_payments WHERE id = p_payment_id;

  DELETE FROM public.debt_payments WHERE id = p_payment_id;
  IF v_expense_id IS NOT NULL THEN
    DELETE FROM public.expenses WHERE id = v_expense_id AND user_id = auth.uid();
  END IF;
END;
$$;
