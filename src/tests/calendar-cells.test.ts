import { describe, it, expect } from "vitest";
import { buildCalendarCells } from "@/lib/utils/calendar-cells";
import type { BillOccurrence, BillPayment } from "@/lib/types";

const occurrences: BillOccurrence[] = [
  { bill_id: "b1", billName: "Rent", dueDate: "2026-09-01", expectedAmount: 12000, cutoffPeriodEnd: "2026-09-13" },
  { bill_id: "b2", billName: "Electric", dueDate: "2026-09-20", expectedAmount: 1500, cutoffPeriodEnd: "2026-09-28" },
];

const paidRent: BillPayment = {
  id: "p1",
  bill_id: "b1",
  due_date: "2026-09-01",
  paid_at: "2026-09-01",
  amount: "12300",
  expense_id: null,
  created_at: "x",
  updated_at: "x",
};

describe("buildCalendarCells", () => {
  it("marks paid, overdue, and today states per cell", () => {
    const cells = buildCalendarCells(2026, 8, occurrences, [paidRent], "2026-09-13");
    const rentDay = cells.find((c) => c.date === "2026-09-01");
    const elecDay = cells.find((c) => c.date === "2026-09-20");
    expect(rentDay?.occurrences[0].paid).toBe(true);
    expect(elecDay?.occurrences[0].paid).toBe(false);
    expect(elecDay?.occurrences[0].overdue).toBe(false);
    expect(cells.find((c) => c.date === "2026-09-13")?.isToday).toBe(true);
  });

  it("tags cutoff anchor days", () => {
    const cells = buildCalendarCells(2026, 8, occurrences, [], "2026-09-13");
    const anchor = cells.find((c) => c.date === "2026-09-28");
    expect(anchor?.isCutoffAnchor).toBe(true);
  });
});