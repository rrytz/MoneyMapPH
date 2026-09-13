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
    expect(view.occurrences.every((o) => o.dueDate.startsWith("2026-08"))).toBe(true); // 1-based month: 8 => August
  });

  // K2-WINDOW contract: getBillsDueBy(fromDate, toDate) windows to the current cutoff.
  // Representative window: 2026-09-14 (cutoff start) .. 2026-09-28 (horizon).
  const FROM = "2026-09-14";
  const TO = "2026-09-28";

  it("getBillsDueBy totals paid-at-actual and unpaid-at-expected", async () => {
    const supabase = makeSupabase({
      bills: [
        billRow({ id: "bill1", name: "Rent", expected_amount: "1000", day_of_month: 1 }),
        billRow({ id: "bill28", name: "WiFi", expected_amount: "1000", day_of_month: 28 }),
      ],
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
    const due = await getBillsDueBy(supabase, userId, FROM, TO);
    expect(typeof due.totalDue).toBe("number");
    expect(due.horizonDate).toBe(TO);
    expect(due.occurrences).toHaveLength(1); // only bill28's 09-28: bill1's 09-01 is before fromDate
    expect(due.occurrences[0].dueDate).toBe("2026-09-28"); // K2-WINDOW: horizon inclusive
    expect(due.upcomingTotal).toBe(1000);
    expect(due.paidTotal).toBe(0); // K2-WINDOW: payment due after toDate is excluded
  });

  it("K2-WINDOW: a bill due after toDate is NOT in upcoming", async () => {
    const supabase = makeSupabase({
      bills: [billRow({ id: "later", name: "Loan", expected_amount: "2500", day_of_month: 10 })],
      bill_payments: [] as BillPayment[],
    });
    const due = await getBillsDueBy(supabase, userId, FROM, TO);
    expect(due.occurrences).toHaveLength(0); // 10-10 falls after toDate
    expect(due.upcomingTotal).toBe(0);
    expect(due.paidTotal).toBe(0);
  });

  it("K2-WINDOW: a bill due before fromDate is NOT in upcoming", async () => {
    const supabase = makeSupabase({
      bills: [billRow({ id: "early", name: "Rent", expected_amount: "1000", day_of_month: 1 })],
      bill_payments: [] as BillPayment[],
    });
    const due = await getBillsDueBy(supabase, userId, FROM, TO);
    expect(due.occurrences).toHaveLength(0); // 09-01 falls before fromDate
    expect(due.upcomingTotal).toBe(0);
    expect(due.paidTotal).toBe(0);
  });

  it("K2-WINDOW: an unpaid overdue occurrence inside the window IS included", async () => {
    const supabase = makeSupabase({
      bills: [billRow({ id: "mid", name: "Electric", expected_amount: "1200", day_of_month: 16 })],
      bill_payments: [] as BillPayment[],
    });
    const due = await getBillsDueBy(supabase, userId, FROM, TO);
    expect(due.occurrences.map((o) => o.dueDate)).toEqual(["2026-09-16"]);
    expect(due.upcomingTotal).toBe(1200);
  });

  it("K2-WINDOW: a payment with due_date inside the window counts in paidTotal and its occurrence leaves upcoming", async () => {
    const supabase = makeSupabase({
      bills: [
        billRow({ id: "bill20", name: "Water", expected_amount: "1200", day_of_month: 20 }),
        billRow({ id: "bill28", name: "WiFi", expected_amount: "500", day_of_month: 28 }),
      ],
      bill_payments: [
        {
          id: "p1",
          bill_id: "bill28",
          due_date: "2026-09-28",
          paid_at: "2026-09-28T00:00:00.000Z",
          amount: "500",
          expense_id: null,
          created_at: "x",
          updated_at: "x",
        },
      ],
    });
    const due = await getBillsDueBy(supabase, userId, FROM, TO);
    expect(due.occurrences.map((o) => o.dueDate)).toEqual(["2026-09-20"]); // bill28's 09-28 paid → excluded
    expect(due.paidTotal).toBe(500); // K2-WINDOW: payment due inside window counts
    expect(due.upcomingTotal).toBe(1200);
    expect(due.totalDue).toBe(1700);
  });

  it("K2-WINDOW: a payment with due_date before fromDate does NOT count in paidTotal (last cutoff's paid)", async () => {
    const supabase = makeSupabase({
      bills: [billRow({ id: "bill1", name: "Rent", expected_amount: "1000", day_of_month: 1 })],
      bill_payments: [
        {
          id: "p1",
          bill_id: "bill1",
          due_date: "2026-09-01",
          paid_at: "2026-09-01T00:00:00.000Z",
          amount: "300",
          expense_id: null,
          created_at: "x",
          updated_at: "x",
        },
      ],
    });
    const due = await getBillsDueBy(supabase, userId, FROM, TO);
    expect(due.occurrences).toHaveLength(0);
    expect(due.paidTotal).toBe(0); // 09-01 < fromDate → last cutoff's paid, excluded
    expect(due.upcomingTotal).toBe(0);
    expect(due.totalDue).toBe(0);
  });

  it("deleteBill deletes user-scoped", async () => {
    const supabase = makeSupabase({ bills: [] });
    await expect(deleteBill(supabase, userId, "b1")).resolves.toBeUndefined();
  });
});
