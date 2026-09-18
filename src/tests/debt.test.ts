import { describe, it, expect } from "vitest";
import {
  debtPaidOffAmount,
  debtRemaining,
  debtProgress,
  isDebtPaidOff,
  isDebtOverdue,
} from "@/lib/utils/debt";
import type { Debt, DebtPayment } from "@/lib/types";

const debt = (over: Partial<Debt> = {}): Debt => ({
  id: "d1",
  user_id: "u1",
  name: "Motorcycle Loan",
  total_amount: "20000",
  due_date: "2026-10-30",
  category_id: null,
  notes: null,
  created_at: "2026-09-18T00:00:00.000Z",
  updated_at: "2026-09-18T00:00:00.000Z",
  ...over,
});

const pay = (over: Partial<DebtPayment> = {}): DebtPayment => ({
  id: "p1",
  debt_id: "d1",
  paid_at: "2026-09-18",
  amount: "5000",
  expense_id: "e1",
  created_at: "2026-09-18T00:00:00.000Z",
  updated_at: "2026-09-18T00:00:00.000Z",
  ...over,
});

describe("debtPaidOffAmount", () => {
  it("returns 0 for no payments", () => {
    expect(debtPaidOffAmount([])).toBe(0);
  });
  it("sums partial payments to the cent", () => {
    expect(debtPaidOffAmount([pay(), pay({ amount: "1500.25" }), pay({ amount: "0.75" })])).toBe(6501);
  });
});

describe("debtRemaining", () => {
  it("is full total with no payments", () => {
    expect(debtRemaining(debt(), 0)).toBe(20000);
  });
  it("subtracts paid amount", () => {
    expect(debtRemaining(debt(), 5000)).toBe(15000);
  });
  it("floors at 0 on overpayment (defensive)", () => {
    expect(debtRemaining(debt(), 21000)).toBe(0);
  });
});

describe("debtProgress", () => {
  it("is 0 with nothing paid", () => {
    expect(debtProgress(debt(), 0)).toBe(0);
  });
  it("is paid / total", () => {
    expect(debtProgress(debt(), 5000)).toBeCloseTo(0.25);
  });
  it("clamps at 1 on overpayment", () => {
    expect(debtProgress(debt(), 20000)).toBe(1);
    expect(debtProgress(debt(), 25000)).toBe(1);
  });
  it("is 0 when total is 0 (defensive)", () => {
    expect(debtProgress(debt({ total_amount: "0" }), 100)).toBe(0);
  });
});

describe("isDebtPaidOff", () => {
  it("false while remaining", () => {
    expect(isDebtPaidOff(debt(), 5000)).toBe(false);
  });
  it("true when fully paid", () => {
    expect(isDebtPaidOff(debt(), 20000)).toBe(true);
  });
  it("true when overpaid (clamped)", () => {
    expect(isDebtPaidOff(debt(), 20500)).toBe(true);
  });
});

describe("isDebtOverdue", () => {
  const today = "2026-09-18";
  it("false before due date", () => {
    expect(isDebtOverdue(debt(), 0, "2026-09-18")).toBe(false);
  });
  it("false exactly on due date", () => {
    expect(isDebtOverdue(debt({ due_date: today }), 0, today)).toBe(false);
  });
  it("true after due date while remaining", () => {
    expect(isDebtOverdue(debt(), 5000, "2026-11-01")).toBe(true);
  });
  it("false after due date when paid off", () => {
    expect(isDebtOverdue(debt(), 20000, "2026-11-01")).toBe(false);
  });
});