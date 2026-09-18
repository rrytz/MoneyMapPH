import type { Debt, DebtPayment } from "@/lib/types";

const toNum = (v: string): number => Number(v);

export function debtPaidOffAmount(payments: DebtPayment[]): number {
  return payments.reduce((sum, p) => sum + toNum(p.amount), 0);
}

export function debtRemaining(debt: Pick<Debt, "total_amount">, paid: number): number {
  return Math.max(0, toNum(debt.total_amount) - paid);
}

export function debtProgress(debt: Pick<Debt, "total_amount">, paid: number): number {
  const total = toNum(debt.total_amount);
  if (total <= 0) return 0;
  return Math.min(1, paid / total);
}

export function isDebtPaidOff(debt: Pick<Debt, "total_amount">, paid: number): boolean {
  return debtRemaining(debt, paid) === 0;
}

export function isDebtOverdue(
  debt: Pick<Debt, "total_amount" | "due_date">,
  paid: number,
  today: string
): boolean {
  return paid < toNum(debt.total_amount) && debt.due_date < today;
}