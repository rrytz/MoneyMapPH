-- ============================================================
-- SAVINGS GOALS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  target_date DATE,
  notes TEXT,
  is_emergency_fund BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for user filter speed
CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON public.savings_goals(user_id);

-- Enable RLS
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own savings goals" ON public.savings_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own savings goals" ON public.savings_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own savings goals" ON public.savings_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own savings goals" ON public.savings_goals FOR DELETE USING (auth.uid() = user_id);

-- Trigger for set_updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- LINK EXPENSES TO SAVINGS GOALS
-- ============================================================
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.savings_goals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_goal ON public.expenses(goal_id);

-- ============================================================
-- CONTRIBUTION SYNC TRIGGER
-- ============================================================
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

CREATE OR REPLACE TRIGGER on_expense_contribution_change
  AFTER INSERT OR UPDATE OR DELETE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.sync_savings_goal_amount();

-- Tighten expense RLS to also validate goal ownership (goal_id added above).
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
