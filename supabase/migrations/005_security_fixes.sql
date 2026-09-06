-- ============================================================
-- 005: SECURITY HARDENING — cross-user isolation fixes
-- Applies to any database that already ran 001-004.
-- Idempotent: safe on fresh databases too (via `supabase db reset`).
-- ============================================================

-- Lock search_path on SECURITY DEFINER trigger functions so unqualified
-- object resolution never follows a caller-controlled schema.
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_savings_goal_amount() SET search_path = public, pg_temp;

-- Rebuild sync_savings_goal_amount with ownership scoping: the updating
-- trigger previously keyed only on goal_id, so a crafted expense row could
-- mutate another user's goal (RLS is bypassed inside SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.sync_savings_goal_amount()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.goal_id IS NOT NULL THEN
      UPDATE public.savings_goals
      SET current_amount = GREATEST(0, current_amount - OLD.amount)
      WHERE id = OLD.goal_id AND user_id = OLD.user_id;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.goal_id IS NOT NULL THEN
      UPDATE public.savings_goals
      SET current_amount = current_amount + NEW.amount
      WHERE id = NEW.goal_id AND user_id = NEW.user_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.goal_id IS DISTINCT FROM NEW.goal_id THEN
      IF OLD.goal_id IS NOT NULL THEN
        UPDATE public.savings_goals
        SET current_amount = GREATEST(0, current_amount - OLD.amount)
        WHERE id = OLD.goal_id AND user_id = OLD.user_id;
      END IF;
      IF NEW.goal_id IS NOT NULL THEN
        UPDATE public.savings_goals
        SET current_amount = current_amount + NEW.amount
        WHERE id = NEW.goal_id AND user_id = NEW.user_id;
      END IF;
    ELSIF NEW.goal_id IS NOT NULL THEN
      UPDATE public.savings_goals
      SET current_amount = GREATEST(0, current_amount + (NEW.amount - OLD.amount))
      WHERE id = NEW.goal_id AND user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Recreate income_entries RLS with FK ownership checks so users cannot
-- reference another user's income source or paycheck (which previously
-- allowed cross-user reference DoS via ON DELETE RESTRICT).
DROP POLICY IF EXISTS "Users can insert own income" ON public.income_entries;
CREATE POLICY "Users can insert own income" ON public.income_entries FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND (source_id IS NULL OR EXISTS (SELECT 1 FROM public.income_sources isrc WHERE isrc.id = source_id AND isrc.user_id = auth.uid()))
  AND (paycheck_id IS NULL OR EXISTS (SELECT 1 FROM public.paychecks pck WHERE pck.id = paycheck_id AND pck.user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can update own income" ON public.income_entries;
CREATE POLICY "Users can update own income" ON public.income_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (source_id IS NULL OR EXISTS (SELECT 1 FROM public.income_sources isrc WHERE isrc.id = source_id AND isrc.user_id = auth.uid()))
    AND (paycheck_id IS NULL OR EXISTS (SELECT 1 FROM public.paychecks pck WHERE pck.id = paycheck_id AND pck.user_id = auth.uid()))
  );

-- Recreate expenses RLS with FK ownership checks for category, paycheck,
-- and savings goal (same rationale).
DROP POLICY IF EXISTS "Users can insert own expenses" ON public.expenses;
CREATE POLICY "Users can insert own expenses" ON public.expenses FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND (category_id IS NULL OR EXISTS (SELECT 1 FROM public.expense_categories ec WHERE ec.id = category_id AND ec.user_id = auth.uid()))
  AND (paycheck_id IS NULL OR EXISTS (SELECT 1 FROM public.paychecks pck WHERE pck.id = paycheck_id AND pck.user_id = auth.uid()))
  AND (goal_id IS NULL OR EXISTS (SELECT 1 FROM public.savings_goals sg WHERE sg.id = goal_id AND sg.user_id = auth.uid()))
);

DROP POLICY IF EXISTS "Users can update own expenses" ON public.expenses;
CREATE POLICY "Users can update own expenses" ON public.expenses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (category_id IS NULL OR EXISTS (SELECT 1 FROM public.expense_categories ec WHERE ec.id = category_id AND ec.user_id = auth.uid()))
    AND (paycheck_id IS NULL OR EXISTS (SELECT 1 FROM public.paychecks pck WHERE pck.id = paycheck_id AND pck.user_id = auth.uid()))
    AND (goal_id IS NULL OR EXISTS (SELECT 1 FROM public.savings_goals sg WHERE sg.id = goal_id AND sg.user_id = auth.uid()))
  );