import { describe, it, expect } from "vitest";
import { makeSupabase } from "@/tests/supabase-mock";
import { createBill, deleteBill, getBillView, getBillsDueBy } from "@/lib/services/bills.service";
import type { Bill, BillPayment } from "@/lib/types";

const userId = "u1";

function billRow(over: Partial<Bill>): Bill {
  return {
    id: "b1",
    user_id: userId,
    name: "Rent",
    expected_amount: "12000",
    category_id: null,
    day_of_month: 1,
    active: true,
    notes: null,
    created_at: "x",
    updated_at: "x",
    ...over,
  };
}

describe("bills.service", () => {
  it("createBill inserts a row scoped to the user", async () => {
    const supabase = makeSupabase({ bills: [] });
    const bill = await createBill(supabase, userId, { name: "Internet", day_of_month: 15 });
    expect(bill.id).toBe("n1");
    expect(bill.user_id).toBe(userId);
  });

  it("getBillView keeps the raw bill array separate from gated occurrences", async () => {
    const supabase = makeSupabase({
      bills: [
        billRow({ id: "ready", name: "Rent", expected_amount: "12000", day_of_month: 1 }),
        billRow({ id: "paused", name: "Net", expected_amount: "1500", day_of_month: 15, active: false }),
      ],
      bill_payments: [] as BillPayment[],
    });
    const view = await getBillView(supabase, userId, 2026, 8);
    expect(view.bills.length).toBe(2); // raw: management list sees everything
    const paid = view.occurrences.every((o) => o.bill_id === "ready"); // engine gate: only ready+active
    expect(paid).toBe(true);
  });

  it("getBillsDueBy totals paid-at-actual and unpaid-at-expected", async () => {
    const supabase = makeSupabase({
      bills: [billRow({ id: "bill28", name: "WiFi", expected_amount: "1000", day_of_month: 28 })],
      bill_payments: [
        {
          id: "p1",
          bill_id: "bill28",
          due_date: "2026-10-05",
          paid_at: "2026-10-05T00:00:00.000Z",
          amount: "500",
          expense_id: null,
          created_at: "x",
          updated_at: "x",
        },
      ],
    });
    const due = await getBillsDueBy(supabase, userId, "2026-09-28");
    expect(typeof due.totalDue).toBe("number");
    expect(due.horizonDate).toBe("2026-09-28");
    expect(due.occurrences.some((o) => o.dueDate === "2026-09-28")).toBe(true); // R13: horizon inclusive
    expect(due.paidTotal).toBe(0); // R7: payment due after horizon is excluded
  });

  it("deleteBill deletes user-scoped", async () => {
    const supabase = makeSupabase({ bills: [] });
    await expect(deleteBill(supabase, userId, "b1")).resolves.toBeUndefined();
  });
});
