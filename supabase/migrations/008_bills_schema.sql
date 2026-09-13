-- ============================================================
-- BILLS SCHEMA (K2)
-- Tables, RLS, RPCs, and seeded onboarding templates.
-- NOTE: handle_new_user is recreated here so live DBs (which
-- already ran 001) converge with fresh installs.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  expected_amount NUMERIC(12,2) CHECK (expected_amount IS NULL OR expected_amount > 0),
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  day_of_month INTEGER CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31),
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bills_user ON public.bills(user_id);
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bills" ON public.bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own bills" ON public.bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bills" ON public.bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bills" ON public.bills FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  paid_at DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bill_id, due_date)
);

CREATE INDEX IF NOT EXISTS idx_bill_payments_bill ON public.bill_payments(bill_id, due_date);
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bill payments" ON public.bill_payments
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.bills WHERE bills.id = bill_payments.bill_id AND bills.user_id = auth.uid()));
CREATE POLICY "Users can insert own bill payments" ON public.bill_payments
  FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.bills WHERE bills.id = bill_payments.bill_id AND bills.user_id = auth.uid()));
CREATE POLICY "Users can update own bill payments" ON public.bill_payments
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.bills WHERE bills.id = bill_payments.bill_id AND bills.user_id = auth.uid()));
CREATE POLICY "Users can delete own bill payments" ON public.bill_payments
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.bills WHERE bills.id = bill_payments.bill_id AND bills.user_id = auth.uid()));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bill_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------
-- RPC: pay_bill — log an expense + payment in one transaction
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_bill(
  p_bill_id uuid,
  p_due_date date,
  p_paid_at date,
  p_category_id uuid,
  p_amount numeric,
  p_notes text DEFAULT NULL
) RETURNS public.bill_payments
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_bill public.bills%ROWTYPE;
  v_expense_id uuid;
  v_result public.bill_payments%ROWTYPE;
  v_resolved_category_id uuid;
BEGIN
  SELECT * INTO v_bill FROM public.bills WHERE id = p_bill_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'bill_not_found'; END IF;
  IF v_bill.expected_amount IS NULL OR v_bill.day_of_month IS NULL OR NOT v_bill.active THEN
    RAISE EXCEPTION 'bill_not_ready';
  END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'amount_invalid'; END IF;

  v_resolved_category_id := COALESCE(
    p_category_id,
    v_bill.category_id,
    (SELECT id FROM public.expense_categories ec
      WHERE ec.user_id = auth.uid() AND ec.is_default
      ORDER BY ec.sort_order, ec.id LIMIT 1)
  );
  IF v_resolved_category_id IS NULL THEN
    RAISE EXCEPTION 'category_required';
  END IF;

  INSERT INTO public.expenses (user_id, title, amount, category_id, date, notes)
  VALUES (auth.uid(), v_bill.name, p_amount, v_resolved_category_id, p_paid_at, p_notes)
  RETURNING id INTO v_expense_id;

  INSERT INTO public.bill_payments (bill_id, due_date, paid_at, amount, expense_id)
  VALUES (p_bill_id, p_due_date, p_paid_at, p_amount, v_expense_id)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- ------------------------------------------------------------
-- RPC: unpay_bill — remove payment AND its linked expense atomically
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unpay_bill(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_expense_id uuid;
  v_owned boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.bill_payments bp
    JOIN public.bills b ON b.id = bp.bill_id
    WHERE bp.id = p_payment_id AND b.user_id = auth.uid()
  ) INTO v_owned;
  IF NOT v_owned THEN RAISE EXCEPTION 'payment_not_found'; END IF;

  SELECT expense_id INTO v_expense_id FROM public.bill_payments WHERE id = p_payment_id;

  DELETE FROM public.bill_payments WHERE id = p_payment_id;
  IF v_expense_id IS NOT NULL THEN
    DELETE FROM public.expenses WHERE id = v_expense_id AND user_id = auth.uid();
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- Onboarding: seed bill templates (ready = false, active = true)
-- Recreates handle_new_user with the 001 body + bills.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );

  INSERT INTO public.income_sources (user_id, name, is_default, sort_order) VALUES
    (NEW.id, 'Salary', true, 1),
    (NEW.id, 'Night Differential', true, 2),
    (NEW.id, 'Incentives', true, 3),
    (NEW.id, 'Bonuses', true, 4),
    (NEW.id, 'Holiday Pay', true, 5),
    (NEW.id, 'Overtime Pay', true, 6),
    (NEW.id, 'Freelance Income', true, 7),
    (NEW.id, 'Other Income', true, 8);

  INSERT INTO public.expense_categories (user_id, name, icon, color, is_default, sort_order) VALUES
    (NEW.id, 'Transportation', '🚗', '#6366f1', true, 1),
    (NEW.id, 'Groceries', '🛒', '#8b5cf6', true, 2),
    (NEW.id, 'Supplements', '💊', '#a855f7', true, 3),
    (NEW.id, 'Eating Out', '🍽️', '#d946ef', true, 4),
    (NEW.id, 'Utilities', '💡', '#ec4899', true, 5),
    (NEW.id, 'Rent', '🏠', '#f43f5e', true, 6),
    (NEW.id, 'Internet', '📡', '#f97316', true, 7),
    (NEW.id, 'Savings', '💰', '#14b8a6', true, 8),
    (NEW.id, 'Emergency Fund', '🛡️', '#06b6d4', true, 9),
    (NEW.id, 'Motorcycle Fund', '🏍️', '#0ea5e9', true, 10),
    (NEW.id, 'Miscellaneous', '📦', '#64748b', true, 11);

  INSERT INTO public.bills (user_id, name, active) VALUES
    (NEW.id, 'SSS Contribution', true),
    (NEW.id, 'Pag-IBIG', true),
    (NEW.id, 'PhilHealth', true),
    (NEW.id, 'Rent', true),
    (NEW.id, 'Internet', true),
    (NEW.id, 'Electricity', true),
    (NEW.id, 'Water', true),
    (NEW.id, 'Postpaid/Phone', true),
    (NEW.id, 'Subscriptions', true),
    (NEW.id, 'Loan Payment', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();