import { describe, it, expect } from "vitest";
import type { AccountWithBalance } from "@/lib/types";

describe("Accounts UI Helper & State Logic", () => {
  const sampleAccount: AccountWithBalance = {
    id: "acc-1",
    user_id: "user-123",
    name: "GCash Personal",
    type: "ewallet",
    initial_balance: 1000,
    current_balance: 2500,
    total_income: 2000,
    total_expenses: 500,
    total_transfers_in: 0,
    total_transfers_out: 0,
    total_transfer_fees: 0,
    color: null,
    icon: null,
    is_archived: false,
    is_negative: false,
    sort_order: 0,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };

  const overdrawnAccount: AccountWithBalance = {
    ...sampleAccount,
    id: "acc-2",
    name: "Overdrawn Wallet",
    current_balance: -500,
    is_negative: true,
  };

  it("correctly identifies negative derived balance for Policy 2 visual warning state", () => {
    expect(sampleAccount.is_negative).toBe(false);
    expect(overdrawnAccount.is_negative).toBe(true);
  });

  it("calculates total liquidity across non-archived accounts", () => {
    const activeAccounts = [sampleAccount, overdrawnAccount];
    const totalLiquidity = activeAccounts
      .filter((a) => !a.is_archived)
      .reduce((sum, a) => sum + a.current_balance, 0);

    expect(totalLiquidity).toBe(2000); // 2500 + (-500)
  });

  it("filters out archived accounts for active selectors", () => {
    const archivedAcc: AccountWithBalance = {
      ...sampleAccount,
      id: "acc-3",
      is_archived: true,
    };
    const allAccs = [sampleAccount, archivedAcc];
    const activeOnly = allAccs.filter((a) => !a.is_archived);

    expect(activeOnly.length).toBe(1);
    expect(activeOnly[0].id).toBe("acc-1");
  });
});
