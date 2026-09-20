import { describe, it, expect, vi } from "vitest";
import { getAccountsWithBalances, createAccount, updateAccount, archiveAccount } from "@/lib/services/account.service";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("AccountService", () => {
  const userId = "user-123";

  it("calculates derived balance correctly from initial balance, income, expenses, and transfers", async () => {
    const mockAccounts = [
      {
        id: "acc-1",
        user_id: userId,
        name: "GCash",
        type: "ewallet",
        initial_balance: 1000,
        color: null,
        icon: null,
        is_archived: false,
        sort_order: 0,
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
    ];

    const mockAggregates = [
      {
        account_id: "acc-1",
        total_income: 500,
        total_expenses: 200,
        transfers_in: 300,
        transfers_out: 100,
        transfer_fees: 15,
      },
    ];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "accounts") {
          const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: vi.fn((resolve: (v: any) => void) => resolve({ data: mockAccounts, error: null })),
          };
          Object.defineProperty(chain, Symbol.toStringTag, { value: "Promise" });
          return chain;
        }
        if (table === "income_entries" || table === "expenses") {
          const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            then: vi.fn((resolve: (v: any) => void) => resolve({ data: [{ amount: 50 }], error: null })),
          };
          Object.defineProperty(chain, Symbol.toStringTag, { value: "Promise" });
          return chain;
        }
        return {};
      }),
      rpc: vi.fn().mockResolvedValue({ data: mockAggregates, error: null }),
    } as unknown as SupabaseClient;

    const res = await getAccountsWithBalances(mockSupabase, userId);

    expect(res.accounts.length).toBe(1);
    // current_balance = 1000 + 500 - 200 + 300 - 100 - 15 = 1485
    expect(res.accounts[0].current_balance).toBe(1485);
    expect(res.accounts[0].is_negative).toBe(false);
    expect(res.totalLiquidity).toBe(1485);
    expect(res.unassigned.unassignedIncome).toBe(50);
    expect(res.unassigned.unassignedExpenses).toBe(50);
  });

  it("flags Policy 2 negative derived balance correctly", async () => {
    const mockAccounts = [
      {
        id: "acc-2",
        user_id: userId,
        name: "UnionBank",
        type: "bank",
        initial_balance: 100,
        color: null,
        icon: null,
        is_archived: false,
        sort_order: 0,
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
      },
    ];

    const mockAggregates = [
      {
        account_id: "acc-2",
        total_income: 0,
        total_expenses: 500,
        transfers_in: 0,
        transfers_out: 0,
        transfer_fees: 0,
      },
    ];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "accounts") {
          const chain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: vi.fn((resolve: (v: any) => void) => resolve({ data: mockAccounts, error: null })),
          };
          Object.defineProperty(chain, Symbol.toStringTag, { value: "Promise" });
          return chain;
        }
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          then: vi.fn((resolve: (v: any) => void) => resolve({ data: [], error: null })),
        };
        Object.defineProperty(chain, Symbol.toStringTag, { value: "Promise" });
        return chain;
      }),
      rpc: vi.fn().mockResolvedValue({ data: mockAggregates, error: null }),
    } as unknown as SupabaseClient;

    const res = await getAccountsWithBalances(mockSupabase, userId);

    expect(res.accounts[0].current_balance).toBe(-400);
    expect(res.accounts[0].is_negative).toBe(true);
  });

  it("prevents creating account with negative initial balance", async () => {
    const mockSupabase = {} as SupabaseClient;

    await expect(
      createAccount(mockSupabase, userId, {
        name: "Invalid Acc",
        type: "bank",
        initial_balance: -100,
      })
    ).rejects.toThrow("Initial starting balance must be non-negative.");
  });

  it("updates account metadata with timestamp update", async () => {
    const updatedAccount = {
      id: "acc-1",
      user_id: userId,
      name: "Renamed GCash",
      type: "ewallet",
      initial_balance: 1000,
      updated_at: new Date().toISOString(),
    };

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: updatedAccount, error: null }),
      }),
    } as unknown as SupabaseClient;

    const res = await updateAccount(mockSupabase, userId, "acc-1", { name: "Renamed GCash" });
    expect(res.name).toBe("Renamed GCash");
  });

  it("toggles archive status correctly", async () => {
    const archivedAccount = {
      id: "acc-1",
      user_id: userId,
      name: "GCash",
      is_archived: true,
    };

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: archivedAccount, error: null }),
      }),
    } as unknown as SupabaseClient;

    const res = await archiveAccount(mockSupabase, userId, "acc-1", true);
    expect(res.is_archived).toBe(true);
  });
});
