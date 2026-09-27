-- ============================================================
-- ONE-TIME BILLS
--
-- Until now a bill could only recur: `day_of_month` (1-31) with no date
-- anywhere, so "a bill due on the 5th" meant the 5th of EVERY month, forever.
-- That is correct for electricity, rent and internet, and it is the only thing
-- the model could express - which is why a one-time bill could not be created
-- at all, and why tapping a date on the calendar had nothing to create.
--
-- A nullable due_date is the discriminator, not a new frequency enum:
--
--   due_date IS NOT NULL   one-time. It comes due once, on that date.
--   due_date IS NULL        recurring, on day_of_month, clamped to the last day
--                           of a short month.
--
-- The column is additive and nullable, so no backfill is required and every
-- existing bill keeps its meaning exactly: NULL due_date is precisely what
-- "recurring" already was.
--
-- Invariant worth stating, because pay_bill enforces it: a bill must have
-- EITHER a due_date OR a day_of_month. A bill with neither has no schedule and
-- must not be payable - the RPC already raises bill_not_ready for that, and
-- this keeps that behaviour while no longer blocking a one-time bill merely
-- for lacking day_of_month.
-- ============================================================

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS due_date DATE NULL;

COMMENT ON COLUMN public.bills.due_date IS
  'One-time bills only. NULL means the bill recurs on day_of_month instead.';

-- ------------------------------------------------------------
-- pay_bill: a one-time bill has no day_of_month, so the old readiness
-- check rejected exactly the bills this migration exists to allow.
--
-- The fix is NOT to drop the check - a bill with neither a due_date nor a
-- day_of_month still has no schedule and must stay unpayable. It is to accept
-- EITHER. p_due_date stays the date the payment is recorded against, so the
-- existing (bill_id, due_date) uniqueness and the unpay RPC are untouched.
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

  IF v_bill.expected_amount IS NULL OR NOT v_bill.active THEN
    RAISE EXCEPTION 'bill_not_ready';
  END IF;

  -- A bill needs a schedule of SOME kind. Before this migration the only
  -- schedule was day_of_month, so the test was `day_of_month IS NULL`. A
  -- one-time bill is scheduled by due_date instead, and rejecting it here
  -- would have made one-time bills creatable and unpayable.
  IF v_bill.due_date IS NULL AND v_bill.day_of_month IS NULL THEN
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

  INSERT INTO bill_payments (bill_id, due_date, paid_at, amount, expense_id)
  VALUES (p_bill_id, p_due_date, p_paid_at, p_amount, v_expense_id)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;
