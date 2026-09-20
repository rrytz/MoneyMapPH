import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Accounts Schema & Migration SQL", () => {
  const migrationPath = join(process.cwd(), "supabase/migrations/20260921000000_create_multi_account_system.sql");
  const rawSql = readFileSync(migrationPath, "utf8");
  const sql = rawSql.replace(/\s+/g, " ");

  it("defines the accounts table with RLS and required constraints", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.accounts");
    expect(sql).toContain("CHECK (type IN ('bank', 'ewallet', 'cash', 'digital_bank', 'credit'))");
    expect(sql).toContain("CHECK (initial_balance >= 0)");
    expect(sql).toContain("CONSTRAINT accounts_id_user_id_key UNIQUE (id, user_id)");
    expect(sql).toContain("ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;");
  });

  it("defines the account_transfers table with composite FKs and restriction constraints", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.account_transfers");
    expect(sql).toContain("CHECK (amount > 0)");
    expect(sql).toContain("CHECK (transfer_fee >= 0)");
    expect(sql).toContain("CHECK (from_account_id <> to_account_id)");
    expect(sql).toContain("FOREIGN KEY (from_account_id, user_id) REFERENCES public.accounts(id, user_id) ON DELETE RESTRICT");
    expect(sql).toContain("FOREIGN KEY (to_account_id, user_id) REFERENCES public.accounts(id, user_id) ON DELETE RESTRICT");
    expect(sql).toContain("ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;");
  });

  it("adds optional account_id composite FKs to income_entries and expenses", () => {
    expect(sql).toContain("ALTER TABLE public.income_entries");
    expect(sql).toContain("FOREIGN KEY (account_id, user_id) REFERENCES public.accounts(id, user_id) ON DELETE SET NULL");
    expect(sql).toContain("ALTER TABLE public.expenses");
    expect(sql).toContain("FOREIGN KEY (account_id, user_id) REFERENCES public.accounts(id, user_id) ON DELETE SET NULL");
  });

  it("includes required performance indexes", () => {
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_account_transfers_user_id ON public.account_transfers(user_id);");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_income_entries_account_id ON public.income_entries(account_id);");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_expenses_account_id ON public.expenses(account_id);");
  });
});
