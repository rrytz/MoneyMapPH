import { describe, it, expect, vi } from "vitest";
import { createTransfer, updateTransfer, deleteTransfer, getTransfers } from "@/lib/services/transfer.service";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("TransferService", () => {
  const userId = "user-123";

  it("creates a transfer successfully", async () => {
    const mockAccounts = [
      { id: "acc-1", user_id: userId, is_archived: false },
      { id: "acc-2", user_id: userId, is_archived: false },
    ];

    const mockTransfer = {
      id: "tr-1",
      user_id: userId,
      from_account_id: "acc-1",
      to_account_id: "acc-2",
      amount: 1000,
      transfer_fee: 15,
      date: "2026-09-21",
      notes: "GCash to UnionBank",
      created_at: "2026-09-21T00:00:00Z",
      updated_at: "2026-09-21T00:00:00Z",
    };

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "accounts") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: mockAccounts, error: null }),
          };
        }
        if (table === "account_transfers") {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockTransfer, error: null }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    const res = await createTransfer(mockSupabase, userId, {
      from_account_id: "acc-1",
      to_account_id: "acc-2",
      amount: 1000,
      transfer_fee: 15,
      date: "2026-09-21",
      notes: "GCash to UnionBank",
    });

    expect(res.id).toBe("tr-1");
    expect(res.amount).toBe(1000);
    expect(res.transfer_fee).toBe(15);
  });

  it("rejects same-account transfer", async () => {
    const mockSupabase = {} as SupabaseClient;

    await expect(
      createTransfer(mockSupabase, userId, {
        from_account_id: "acc-1",
        to_account_id: "acc-1",
        amount: 1000,
        date: "2026-09-21",
      })
    ).rejects.toThrow("Source and destination accounts must be different.");
  });

  it("rejects non-positive amount or negative fee", async () => {
    const mockSupabase = {} as SupabaseClient;

    await expect(
      createTransfer(mockSupabase, userId, {
        from_account_id: "acc-1",
        to_account_id: "acc-2",
        amount: 0,
        date: "2026-09-21",
      })
    ).rejects.toThrow("Transfer amount must be greater than zero.");

    await expect(
      createTransfer(mockSupabase, userId, {
        from_account_id: "acc-1",
        to_account_id: "acc-2",
        amount: 100,
        transfer_fee: -10,
        date: "2026-09-21",
      })
    ).rejects.toThrow("Transfer fee cannot be negative.");
  });

  it("rejects transfer referencing archived account", async () => {
    const mockAccounts = [
      { id: "acc-1", user_id: userId, is_archived: true },
      { id: "acc-2", user_id: userId, is_archived: false },
    ];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "accounts") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: mockAccounts, error: null }),
          };
        }
        return {};
      }),
    } as unknown as SupabaseClient;

    await expect(
      createTransfer(mockSupabase, userId, {
        from_account_id: "acc-1",
        to_account_id: "acc-2",
        amount: 100,
        date: "2026-09-21",
      })
    ).rejects.toThrow("Transfers cannot be performed on archived accounts.");
  });

  it("deletes transfer correctly", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: vi.fn((resolve: (v: any) => void) => resolve({ error: null })),
      }),
    } as unknown as SupabaseClient;

    await expect(deleteTransfer(mockSupabase, userId, "tr-1")).resolves.not.toThrow();
  });
});
