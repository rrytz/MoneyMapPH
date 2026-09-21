import { describe, it, expect, vi } from "vitest";
import { addAccount, editAccount, toggleArchiveAccount, addTransfer, editTransfer, removeTransfer } from "@/app/(dashboard)/accounts/actions";

// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "accounts") {
        return {
          insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "acc-1" }, error: null }) }) }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "acc-1" }, error: null }) }) }) }) }),
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [{ id: "acc-1", is_archived: false }, { id: "acc-2", is_archived: false }], error: null }) }) }),
        };
      }
      if (table === "account_transfers") {
        return {
          insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "tr-1" }, error: null }) }) }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "tr-1" }, error: null }) }) }) }) }),
          delete: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }),
        };
      }
      return {};
    }),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

describe("Accounts Server Actions", () => {
  it("validates and adds account successfully", async () => {
    const res = await addAccount({
      name: "GCash Main",
      type: "ewallet",
      initial_balance: 500,
    });
    expect(res.success).toBe(true);
  });

  it("rejects invalid account data via Zod schema", async () => {
    const res = await addAccount({
      name: "",
      type: "ewallet",
      initial_balance: -100,
    });
    expect(res.error).toBeDefined();
  });

  it("validates and adds transfer successfully", async () => {
    const res = await addTransfer({
      from_account_id: "123e4567-e89b-12d3-a456-426614174000",
      to_account_id: "123e4567-e89b-12d3-a456-426614174001",
      amount: 1000,
      transfer_fee: 15,
      date: "2026-09-21",
    });
    expect(res.success).toBe(true);
  });

  it("rejects transfer to same account", async () => {
    const res = await addTransfer({
      from_account_id: "123e4567-e89b-12d3-a456-426614174000",
      to_account_id: "123e4567-e89b-12d3-a456-426614174000",
      amount: 1000,
      date: "2026-09-21",
    });
    expect(res.error).toBe("Source and destination accounts must be different");
  });

  it("scopes mutations to the authenticated user id, not a caller-supplied one", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const client = (await createClient()) as any;

    const res = await removeTransfer("tr-999");
    expect(res.success).toBe(true);

    const fromMock = client.from;
    const transferResults = fromMock.mock.results.filter(
      (r: any) => r.value && typeof r.value.delete === "function"
    );
    expect(transferResults.length).toBeGreaterThan(0);

    const eqCalls: any[][] = [];
    for (const r of transferResults) {
      const deleteChain = r.value.delete();
      eqCalls.push(...(deleteChain.eq.mock.calls as any[][]));
      const fromIdEq = (deleteChain.eq.mock.results as any[])
        .map((res) => res.value && res.value.eq)
        .find(Boolean);
      if (fromIdEq) eqCalls.push(...(fromIdEq.mock.calls as any[][]));
    }

    const userEqCalls = eqCalls.filter((c) => c[0] === "user_id");
    expect(userEqCalls.length).toBeGreaterThan(0);
    for (const [, userId] of userEqCalls) {
      expect(userId).toBe("user-123");
    }
  });
});
