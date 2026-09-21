-- ============================================================
-- BACKUP RESTORE RPC (K4 backup & restore)
-- Single-transaction, upsert-merge restore for all 19 user tables.
-- One function call = one transaction: either every table lands or none
-- does (any exception rolls the whole restore back).
--
-- Security:
--   - SECURITY DEFINER runs as table owner (RLS bypassed), search_path locked.
--   - Format, schemaVersion, unknown-table keys, and ownership are validated
--     before any write. Ownership is enforced three ways:
--       1. every user-scoped file row must carry the owner's user_id,
--       2. profiles.id must equal the owner,
--       3. every FK reference in the file must point at a row restored from
--          this same file, or at an existing row already owned by the caller
--          (validated against the file before any insert — foreign data is
--          never scanned).
--   - Session callers must match p_owner (auth.uid() = p_owner). The owner
--     scope parameter also lets service-role tooling restore a specific
--     account; service-role callers already hold full database access.
-- ============================================================

CREATE OR REPLACE FUNCTION public.moneymap_import_backup(payload jsonb, p_owner uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid;
  v_key text;
  v_rows integer := 0;
BEGIN
  -- Identity: sessions must import for themselves; service role may restore
  -- any owner it is given.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_owner THEN
    RAISE EXCEPTION 'backup_not_authorized';
  END IF;
  v_owner := p_owner;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'backup_owner_required';
  END IF;

  -- Format + version guards.
  IF payload->>'format' IS DISTINCT FROM 'moneymap-backup' THEN
    RAISE EXCEPTION 'backup_invalid_format';
  END IF;
  IF (payload->>'schemaVersion')::int IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'backup_unsupported_version';
  END IF;
  IF jsonb_typeof(payload->'tables') <> 'object' THEN
    RAISE EXCEPTION 'backup_missing_tables';
  END IF;

  -- Strict table whitelist — no silent data gaps from unknown tables.
  FOR v_key IN SELECT jsonb_object_keys(payload->'tables') LOOP
    IF v_key NOT IN (
      'profiles','accounts','income_sources','expense_categories',
      'paychecks','budgets','savings_goals','bills','debts',
      'simulated_purchases','reminders','paycheck_allocations',
      'budget_categories','account_transfers','income_entries','expenses',
      'bill_payments','debt_payments','monthly_snapshots'
    ) THEN
      RAISE EXCEPTION 'backup_unknown_table %', v_key;
    END IF;
  END LOOP;

  -- Ownership guard 1: every user-scoped file row must belong to the owner.
  IF EXISTS (
    SELECT 1
    FROM jsonb_each(payload->'tables') AS t(key, arr),
         jsonb_array_elements(t.arr) AS x(elem)
    WHERE t.key IN (
      'accounts','income_sources','expense_categories','paychecks','budgets',
      'savings_goals','bills','debts','simulated_purchases','reminders',
      'income_entries','expenses','account_transfers','monthly_snapshots'
    )
    AND (x.elem->>'user_id')::uuid IS DISTINCT FROM v_owner
  ) THEN
    RAISE EXCEPTION 'backup_ownership_mismatch';
  END IF;

  -- Ownership guard 2: the profile row must belong to the owner.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(payload->'tables'->'profiles', '[]'::jsonb)) AS p(elem)
    WHERE (p.elem->>'id')::uuid IS DISTINCT FROM v_owner
  ) THEN
    RAISE EXCEPTION 'backup_ownership_mismatch';
  END IF;

  -- Ownership guard 3 (pre-insert): every FK reference in the file must point
  -- at a row being restored from this same file, or at an existing row owned
  -- by the caller. This makes cross-user links impossible without ever scanning
  -- another user's pre-existing rows. Each block is:
  --   [file child] <fk> NOT IN (file parent ids) AND NOT EXISTS (owned parent).

  -- paycheck_allocations -> paychecks / expense_categories
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'paycheck_allocations', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'paycheck_id') IS NOT NULL
      AND (x.elem->>'paycheck_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'paychecks', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.paychecks p WHERE p.id = (x.elem->>'paycheck_id')::uuid AND p.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'paycheck_allocations', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'category_id') IS NOT NULL
      AND (x.elem->>'category_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'expense_categories', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.expense_categories c WHERE c.id = (x.elem->>'category_id')::uuid AND c.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;

  -- budget_categories -> budgets / expense_categories
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'budget_categories', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'budget_id') IS NOT NULL
      AND (x.elem->>'budget_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'budgets', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = (x.elem->>'budget_id')::uuid AND b.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'budget_categories', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'category_id') IS NOT NULL
      AND (x.elem->>'category_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'expense_categories', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.expense_categories c WHERE c.id = (x.elem->>'category_id')::uuid AND c.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;

  -- account_transfers -> accounts (both legs)
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'account_transfers', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'from_account_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'accounts', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = (x.elem->>'from_account_id')::uuid AND a.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'account_transfers', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'to_account_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'accounts', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = (x.elem->>'to_account_id')::uuid AND a.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;

  -- income_entries -> income_sources / paychecks / accounts
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'income_entries', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'source_id') IS NOT NULL
      AND (x.elem->>'source_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'income_sources', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.income_sources s WHERE s.id = (x.elem->>'source_id')::uuid AND s.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'income_entries', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'paycheck_id') IS NOT NULL
      AND (x.elem->>'paycheck_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'paychecks', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.paychecks p WHERE p.id = (x.elem->>'paycheck_id')::uuid AND p.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'income_entries', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'account_id') IS NOT NULL
      AND (x.elem->>'account_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'accounts', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = (x.elem->>'account_id')::uuid AND a.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;

  -- expenses -> expense_categories / paychecks / savings_goals / accounts
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'expenses', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'category_id') IS NOT NULL
      AND (x.elem->>'category_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'expense_categories', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.expense_categories c WHERE c.id = (x.elem->>'category_id')::uuid AND c.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'expenses', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'paycheck_id') IS NOT NULL
      AND (x.elem->>'paycheck_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'paychecks', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.paychecks p WHERE p.id = (x.elem->>'paycheck_id')::uuid AND p.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'expenses', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'goal_id') IS NOT NULL
      AND (x.elem->>'goal_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'savings_goals', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.savings_goals g WHERE g.id = (x.elem->>'goal_id')::uuid AND g.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'expenses', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'account_id') IS NOT NULL
      AND (x.elem->>'account_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'accounts', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = (x.elem->>'account_id')::uuid AND a.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;

  -- bills / debts -> expense_categories
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'bills', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'category_id') IS NOT NULL
      AND (x.elem->>'category_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'expense_categories', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.expense_categories c WHERE c.id = (x.elem->>'category_id')::uuid AND c.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'debts', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'category_id') IS NOT NULL
      AND (x.elem->>'category_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'expense_categories', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.expense_categories c WHERE c.id = (x.elem->>'category_id')::uuid AND c.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;

  -- bill_payments -> bills / expenses
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'bill_payments', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'bill_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'bills', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.bills b WHERE b.id = (x.elem->>'bill_id')::uuid AND b.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'bill_payments', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'expense_id') IS NOT NULL
      AND (x.elem->>'expense_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'expenses', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = (x.elem->>'expense_id')::uuid AND e.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;

  -- debt_payments -> debts / expenses
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'debt_payments', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'debt_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'debts', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.debts d WHERE d.id = (x.elem->>'debt_id')::uuid AND d.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(payload->'tables'->'debt_payments', '[]'::jsonb)) AS x(elem)
    WHERE (x.elem->>'expense_id') IS NOT NULL
      AND (x.elem->>'expense_id')::uuid NOT IN (
        SELECT (y->>'id')::uuid FROM jsonb_array_elements(COALESCE(payload->'tables'->'expenses', '[]'::jsonb)) y)
      AND NOT EXISTS (SELECT 1 FROM public.expenses e WHERE e.id = (x.elem->>'expense_id')::uuid AND e.user_id = v_owner)
  ) THEN RAISE EXCEPTION 'backup_ownership_mismatch'; END IF;

  -- ---------- Upserts (parents first, children after) ----------

  -- profiles
  IF jsonb_typeof(payload->'tables'->'profiles') = 'array' AND jsonb_array_length(payload->'tables'->'profiles') > 0 THEN
    INSERT INTO public.profiles (id, display_name, currency, theme, avatar_url, created_at, updated_at)
    SELECT x.id, x.display_name, x.currency, x.theme, x.avatar_url, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'profiles')
      AS x(id uuid, display_name text, currency text, theme text, avatar_url text, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name, currency = EXCLUDED.currency,
      theme = EXCLUDED.theme, avatar_url = EXCLUDED.avatar_url,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'profiles');
  END IF;

  -- accounts
  IF jsonb_typeof(payload->'tables'->'accounts') = 'array' AND jsonb_array_length(payload->'tables'->'accounts') > 0 THEN
    INSERT INTO public.accounts (id, user_id, name, type, initial_balance, color, icon, is_archived, sort_order, created_at, updated_at)
    SELECT x.id, x.user_id, x.name, x.type, x.initial_balance, x.color, x.icon, x.is_archived, x.sort_order, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'accounts')
      AS x(id uuid, user_id uuid, name text, type text, initial_balance numeric, color text, icon text, is_archived boolean, sort_order integer, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id, name = EXCLUDED.name, type = EXCLUDED.type,
      initial_balance = EXCLUDED.initial_balance, color = EXCLUDED.color, icon = EXCLUDED.icon,
      is_archived = EXCLUDED.is_archived, sort_order = EXCLUDED.sort_order,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'accounts');
  END IF;

  -- income_sources
  IF jsonb_typeof(payload->'tables'->'income_sources') = 'array' AND jsonb_array_length(payload->'tables'->'income_sources') > 0 THEN
    INSERT INTO public.income_sources (id, user_id, name, is_default, sort_order, type, created_at, updated_at)
    SELECT x.id, x.user_id, x.name, x.is_default, x.sort_order, x.type, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'income_sources')
      AS x(id uuid, user_id uuid, name text, is_default boolean, sort_order integer, type text, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id, name = EXCLUDED.name, is_default = EXCLUDED.is_default,
      sort_order = EXCLUDED.sort_order, type = EXCLUDED.type,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'income_sources');
  END IF;

  -- expense_categories
  IF jsonb_typeof(payload->'tables'->'expense_categories') = 'array' AND jsonb_array_length(payload->'tables'->'expense_categories') > 0 THEN
    INSERT INTO public.expense_categories (id, user_id, name, icon, color, is_default, sort_order, created_at, updated_at)
    SELECT x.id, x.user_id, x.name, x.icon, x.color, x.is_default, x.sort_order, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'expense_categories')
      AS x(id uuid, user_id uuid, name text, icon text, color text, is_default boolean, sort_order integer, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id, name = EXCLUDED.name, icon = EXCLUDED.icon, color = EXCLUDED.color,
      is_default = EXCLUDED.is_default, sort_order = EXCLUDED.sort_order,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'expense_categories');
  END IF;

  -- paychecks
  IF jsonb_typeof(payload->'tables'->'paychecks') = 'array' AND jsonb_array_length(payload->'tables'->'paychecks') > 0 THEN
    INSERT INTO public.paychecks (id, user_id, name, amount, date, period_end, notes, created_at, updated_at)
    SELECT x.id, x.user_id, x.name, x.amount, x.date, x.period_end, x.notes, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'paychecks')
      AS x(id uuid, user_id uuid, name text, amount numeric, date date, period_end date, notes text, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id, name = EXCLUDED.name, amount = EXCLUDED.amount,
      date = EXCLUDED.date, period_end = EXCLUDED.period_end, notes = EXCLUDED.notes,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'paychecks');
  END IF;

  -- budgets
  IF jsonb_typeof(payload->'tables'->'budgets') = 'array' AND jsonb_array_length(payload->'tables'->'budgets') > 0 THEN
    INSERT INTO public.budgets (id, user_id, month, year, notes, created_at, updated_at)
    SELECT x.id, x.user_id, x.month, x.year, x.notes, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'budgets')
      AS x(id uuid, user_id uuid, month integer, year integer, notes text, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id, month = EXCLUDED.month, year = EXCLUDED.year, notes = EXCLUDED.notes,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'budgets');
  END IF;

  -- savings_goals
  IF jsonb_typeof(payload->'tables'->'savings_goals') = 'array' AND jsonb_array_length(payload->'tables'->'savings_goals') > 0 THEN
    INSERT INTO public.savings_goals (id, user_id, name, target_amount, current_amount, target_date, notes, is_emergency_fund, created_at, updated_at)
    SELECT x.id, x.user_id, x.name, x.target_amount, x.current_amount, x.target_date, x.notes, x.is_emergency_fund, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'savings_goals')
      AS x(id uuid, user_id uuid, name text, target_amount numeric, current_amount numeric, target_date date, notes text, is_emergency_fund boolean, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id, name = EXCLUDED.name, target_amount = EXCLUDED.target_amount,
      current_amount = EXCLUDED.current_amount, target_date = EXCLUDED.target_date, notes = EXCLUDED.notes,
      is_emergency_fund = EXCLUDED.is_emergency_fund,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'savings_goals');
  END IF;

  -- bills
  IF jsonb_typeof(payload->'tables'->'bills') = 'array' AND jsonb_array_length(payload->'tables'->'bills') > 0 THEN
    INSERT INTO public.bills (id, user_id, name, expected_amount, category_id, day_of_month, active, notes, created_at, updated_at)
    SELECT x.id, x.user_id, x.name, x.expected_amount, x.category_id, x.day_of_month, x.active, x.notes, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'bills')
      AS x(id uuid, user_id uuid, name text, expected_amount numeric, category_id uuid, day_of_month integer, active boolean, notes text, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id, name = EXCLUDED.name, expected_amount = EXCLUDED.expected_amount,
      category_id = EXCLUDED.category_id, day_of_month = EXCLUDED.day_of_month, active = EXCLUDED.active,
      notes = EXCLUDED.notes, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'bills');
  END IF;

  -- debts
  IF jsonb_typeof(payload->'tables'->'debts') = 'array' AND jsonb_array_length(payload->'tables'->'debts') > 0 THEN
    INSERT INTO public.debts (id, user_id, name, total_amount, due_date, category_id, notes, created_at, updated_at)
    SELECT x.id, x.user_id, x.name, x.total_amount, x.due_date, x.category_id, x.notes, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'debts')
      AS x(id uuid, user_id uuid, name text, total_amount numeric, due_date date, category_id uuid, notes text, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id, name = EXCLUDED.name, total_amount = EXCLUDED.total_amount,
      due_date = EXCLUDED.due_date, category_id = EXCLUDED.category_id, notes = EXCLUDED.notes,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'debts');
  END IF;

  -- simulated_purchases
  IF jsonb_typeof(payload->'tables'->'simulated_purchases') = 'array' AND jsonb_array_length(payload->'tables'->'simulated_purchases') > 0 THEN
    INSERT INTO public.simulated_purchases (id, user_id, name, amount, target_date, notes, created_at, updated_at)
    SELECT x.id, x.user_id, x.name, x.amount, x.target_date, x.notes, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'simulated_purchases')
      AS x(id uuid, user_id uuid, name text, amount numeric, target_date date, notes text, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id, name = EXCLUDED.name, amount = EXCLUDED.amount,
      target_date = EXCLUDED.target_date, notes = EXCLUDED.notes,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'simulated_purchases');
  END IF;

  -- reminders
  IF jsonb_typeof(payload->'tables'->'reminders') = 'array' AND jsonb_array_length(payload->'tables'->'reminders') > 0 THEN
    INSERT INTO public.reminders (id, user_id, title, due_date, completed, notes, created_at, updated_at)
    SELECT x.id, x.user_id, x.title, x.due_date, x.completed, x.notes, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'reminders')
      AS x(id uuid, user_id uuid, title text, due_date date, completed boolean, notes text, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id, title = EXCLUDED.title, due_date = EXCLUDED.due_date,
      completed = EXCLUDED.completed, notes = EXCLUDED.notes,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'reminders');
  END IF;

  -- paycheck_allocations (child of paychecks)
  IF jsonb_typeof(payload->'tables'->'paycheck_allocations') = 'array' AND jsonb_array_length(payload->'tables'->'paycheck_allocations') > 0 THEN
    INSERT INTO public.paycheck_allocations (id, paycheck_id, category_id, label, amount, created_at, updated_at)
    SELECT x.id, x.paycheck_id, x.category_id, x.label, x.amount, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'paycheck_allocations')
      AS x(id uuid, paycheck_id uuid, category_id uuid, label text, amount numeric, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      paycheck_id = EXCLUDED.paycheck_id, category_id = EXCLUDED.category_id, label = EXCLUDED.label,
      amount = EXCLUDED.amount, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'paycheck_allocations');
  END IF;

  -- budget_categories (child of budgets)
  IF jsonb_typeof(payload->'tables'->'budget_categories') = 'array' AND jsonb_array_length(payload->'tables'->'budget_categories') > 0 THEN
    INSERT INTO public.budget_categories (id, budget_id, category_id, amount, created_at, updated_at)
    SELECT x.id, x.budget_id, x.category_id, x.amount, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'budget_categories')
      AS x(id uuid, budget_id uuid, category_id uuid, amount numeric, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      budget_id = EXCLUDED.budget_id, category_id = EXCLUDED.category_id, amount = EXCLUDED.amount,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'budget_categories');
  END IF;

  -- account_transfers (child of accounts)
  IF jsonb_typeof(payload->'tables'->'account_transfers') = 'array' AND jsonb_array_length(payload->'tables'->'account_transfers') > 0 THEN
    INSERT INTO public.account_transfers (id, user_id, from_account_id, to_account_id, amount, transfer_fee, date, notes, created_at, updated_at)
    SELECT x.id, x.user_id, x.from_account_id, x.to_account_id, x.amount, x.transfer_fee, x.date, x.notes, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'account_transfers')
      AS x(id uuid, user_id uuid, from_account_id uuid, to_account_id uuid, amount numeric, transfer_fee numeric, date date, notes text, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id, from_account_id = EXCLUDED.from_account_id, to_account_id = EXCLUDED.to_account_id,
      amount = EXCLUDED.amount, transfer_fee = EXCLUDED.transfer_fee, date = EXCLUDED.date, notes = EXCLUDED.notes,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'account_transfers');
  END IF;

  -- income_entries
  IF jsonb_typeof(payload->'tables'->'income_entries') = 'array' AND jsonb_array_length(payload->'tables'->'income_entries') > 0 THEN
    INSERT INTO public.income_entries (id, user_id, amount, source_id, date, notes, paycheck_id, account_id, created_at, updated_at)
    SELECT x.id, x.user_id, x.amount, x.source_id, x.date, x.notes, x.paycheck_id, x.account_id, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'income_entries')
      AS x(id uuid, user_id uuid, amount numeric, source_id uuid, date date, notes text, paycheck_id uuid, account_id uuid, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id, amount = EXCLUDED.amount, source_id = EXCLUDED.source_id,
      date = EXCLUDED.date, notes = EXCLUDED.notes, paycheck_id = EXCLUDED.paycheck_id,
      account_id = EXCLUDED.account_id,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'income_entries');
  END IF;

  -- expenses
  IF jsonb_typeof(payload->'tables'->'expenses') = 'array' AND jsonb_array_length(payload->'tables'->'expenses') > 0 THEN
    INSERT INTO public.expenses (id, user_id, title, amount, category_id, date, notes, paycheck_id, goal_id, account_id, created_at, updated_at)
    SELECT x.id, x.user_id, x.title, x.amount, x.category_id, x.date, x.notes, x.paycheck_id, x.goal_id, x.account_id, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'expenses')
      AS x(id uuid, user_id uuid, title text, amount numeric, category_id uuid, date date, notes text, paycheck_id uuid, goal_id uuid, account_id uuid, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id, title = EXCLUDED.title, amount = EXCLUDED.amount,
      category_id = EXCLUDED.category_id, date = EXCLUDED.date, notes = EXCLUDED.notes,
      paycheck_id = EXCLUDED.paycheck_id, goal_id = EXCLUDED.goal_id, account_id = EXCLUDED.account_id,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'expenses');
  END IF;

  -- bill_payments (child of bills; links to expenses)
  IF jsonb_typeof(payload->'tables'->'bill_payments') = 'array' AND jsonb_array_length(payload->'tables'->'bill_payments') > 0 THEN
    INSERT INTO public.bill_payments (id, bill_id, due_date, paid_at, amount, expense_id, created_at, updated_at)
    SELECT x.id, x.bill_id, x.due_date, x.paid_at, x.amount, x.expense_id, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'bill_payments')
      AS x(id uuid, bill_id uuid, due_date date, paid_at date, amount numeric, expense_id uuid, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      bill_id = EXCLUDED.bill_id, due_date = EXCLUDED.due_date, paid_at = EXCLUDED.paid_at,
      amount = EXCLUDED.amount, expense_id = EXCLUDED.expense_id,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'bill_payments');
  END IF;

  -- debt_payments (child of debts; links to expenses)
  IF jsonb_typeof(payload->'tables'->'debt_payments') = 'array' AND jsonb_array_length(payload->'tables'->'debt_payments') > 0 THEN
    INSERT INTO public.debt_payments (id, debt_id, paid_at, amount, expense_id, created_at, updated_at)
    SELECT x.id, x.debt_id, x.paid_at, x.amount, x.expense_id, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'debt_payments')
      AS x(id uuid, debt_id uuid, paid_at date, amount numeric, expense_id uuid, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      debt_id = EXCLUDED.debt_id, paid_at = EXCLUDED.paid_at, amount = EXCLUDED.amount,
      expense_id = EXCLUDED.expense_id,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'debt_payments');
  END IF;

  -- monthly_snapshots
  IF jsonb_typeof(payload->'tables'->'monthly_snapshots') = 'array' AND jsonb_array_length(payload->'tables'->'monthly_snapshots') > 0 THEN
    INSERT INTO public.monthly_snapshots (id, user_id, month, year, total_income, total_expenses, total_budget, savings_amount, savings_rate, category_breakdown, income_breakdown, snapshot_date, created_at, updated_at)
    SELECT x.id, x.user_id, x.month, x.year, x.total_income, x.total_expenses, x.total_budget, x.savings_amount, x.savings_rate, x.category_breakdown, x.income_breakdown, x.snapshot_date, x.created_at, x.updated_at
    FROM jsonb_to_recordset(payload->'tables'->'monthly_snapshots')
      AS x(id uuid, user_id uuid, month integer, year integer, total_income numeric, total_expenses numeric, total_budget numeric, savings_amount numeric, savings_rate numeric, category_breakdown jsonb, income_breakdown jsonb, snapshot_date timestamptz, created_at timestamptz, updated_at timestamptz)
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id, month = EXCLUDED.month, year = EXCLUDED.year,
      total_income = EXCLUDED.total_income, total_expenses = EXCLUDED.total_expenses,
      total_budget = EXCLUDED.total_budget, savings_amount = EXCLUDED.savings_amount,
      savings_rate = EXCLUDED.savings_rate, category_breakdown = EXCLUDED.category_breakdown,
      income_breakdown = EXCLUDED.income_breakdown, snapshot_date = EXCLUDED.snapshot_date,
      created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at;
    v_rows := v_rows + jsonb_array_length(payload->'tables'->'monthly_snapshots');
  END IF;

  RETURN v_rows;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.moneymap_import_backup(jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moneymap_import_backup(jsonb, uuid) TO authenticated;