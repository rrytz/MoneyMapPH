-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  currency TEXT NOT NULL DEFAULT 'PHP',
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- INCOME SOURCES
-- ============================================================
CREATE TABLE public.income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_income_sources_user ON public.income_sources(user_id);
ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own income sources" ON public.income_sources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own income sources" ON public.income_sources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own income sources" ON public.income_sources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own income sources" ON public.income_sources FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- EXPENSE CATEGORIES
-- ============================================================
CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expense_categories_user ON public.expense_categories(user_id);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own categories" ON public.expense_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.expense_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.expense_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.expense_categories FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- PAYCHECKS
-- ============================================================
CREATE TABLE public.paychecks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_paychecks_user_date ON public.paychecks(user_id, date);
ALTER TABLE public.paychecks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own paychecks" ON public.paychecks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own paychecks" ON public.paychecks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own paychecks" ON public.paychecks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own paychecks" ON public.paychecks FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- PAYCHECK ALLOCATIONS
-- ============================================================
CREATE TABLE public.paycheck_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paycheck_id UUID NOT NULL REFERENCES public.paychecks(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_paycheck_allocations_paycheck ON public.paycheck_allocations(paycheck_id);
ALTER TABLE public.paycheck_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own allocations" ON public.paycheck_allocations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.paychecks WHERE paychecks.id = paycheck_allocations.paycheck_id AND paychecks.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own allocations" ON public.paycheck_allocations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.paychecks WHERE paychecks.id = paycheck_allocations.paycheck_id AND paychecks.user_id = auth.uid())
  );
CREATE POLICY "Users can update own allocations" ON public.paycheck_allocations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.paychecks WHERE paychecks.id = paycheck_allocations.paycheck_id AND paychecks.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own allocations" ON public.paycheck_allocations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.paychecks WHERE paychecks.id = paycheck_allocations.paycheck_id AND paychecks.user_id = auth.uid())
  );

-- ============================================================
-- INCOME ENTRIES
-- ============================================================
CREATE TABLE public.income_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  source_id UUID NOT NULL REFERENCES public.income_sources(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  notes TEXT,
  paycheck_id UUID REFERENCES public.paychecks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_income_entries_user_date ON public.income_entries(user_id, date);
ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own income" ON public.income_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own income" ON public.income_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own income" ON public.income_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own income" ON public.income_entries FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  notes TEXT,
  paycheck_id UUID REFERENCES public.paychecks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_user_date ON public.expenses(user_id, date);
CREATE INDEX idx_expenses_category ON public.expenses(category_id);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own expenses" ON public.expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expenses" ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON public.expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON public.expenses FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- BUDGETS
-- ============================================================
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

CREATE INDEX idx_budgets_user_period ON public.budgets(user_id, month, year);
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own budgets" ON public.budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own budgets" ON public.budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own budgets" ON public.budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own budgets" ON public.budgets FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- BUDGET CATEGORIES
-- ============================================================
CREATE TABLE public.budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(budget_id, category_id)
);

CREATE INDEX idx_budget_categories_budget ON public.budget_categories(budget_id);
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own budget categories" ON public.budget_categories
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_categories.budget_id AND budgets.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own budget categories" ON public.budget_categories
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_categories.budget_id AND budgets.user_id = auth.uid())
  );
CREATE POLICY "Users can update own budget categories" ON public.budget_categories
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_categories.budget_id AND budgets.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own budget categories" ON public.budget_categories
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.budgets WHERE budgets.id = budget_categories.budget_id AND budgets.user_id = auth.uid())
  );

-- ============================================================
-- MONTHLY SNAPSHOTS
-- ============================================================
CREATE TABLE public.monthly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  total_income NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  savings_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  savings_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  category_breakdown JSONB NOT NULL DEFAULT '{}',
  income_breakdown JSONB NOT NULL DEFAULT '{}',
  snapshot_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

CREATE INDEX idx_snapshots_user_period ON public.monthly_snapshots(user_id, year, month);
ALTER TABLE public.monthly_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own snapshots" ON public.monthly_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own snapshots" ON public.monthly_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own snapshots" ON public.monthly_snapshots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own snapshots" ON public.monthly_snapshots FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'profiles', 'income_sources', 'expense_categories', 'paychecks',
      'paycheck_allocations', 'income_entries', 'expenses', 'budgets',
      'budget_categories', 'monthly_snapshots'
    ])
  LOOP
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()',
      t
    );
  END LOOP;
END;
$$;

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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
