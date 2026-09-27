import { describe, expect, it } from "vitest";
import { listBillOccurrences, isBillOnMoneySurfaces, isOneTimeBill, getBillDueDate } from "@/lib/utils/bills";
import { billInputSchema } from "@/lib/utils/validators";
import type { Bill } from "@/lib/types";

const bill = (over: Partial<Bill> = {}): Bill => ({
  id: "b1",
  user_id: "u1",
  name: "Thing",
  expected_amount: "500",
  category_id: null,
  day_of_month: 1,
  due_date: null,
  active: true,
  notes: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

const sept = (d: number) => new Date(2026, 8, d); // September 2026
const oct = (d: number) => new Date(2026, 9, d);

describe("one-time bills", () => {
  it("emits exactly one occurrence for a one-time bill, in its own month only", () => {
    const one = bill({ day_of_month: null, due_date: "2026-10-05" });

    // October: one occurrence on the 5th.
    const inOct = listBillOccurrences([one], oct(1), oct(31));
    expect(inOct).toHaveLength(1);
    expect(inOct[0].dueDate).toBe("2026-10-05");

    // September and November: none. A one-time bill does not recur, which is
    // the entire point - before due_date, "the 5th" meant the 5th forever.
    expect(listBillOccurrences([one], sept(1), sept(30))).toHaveLength(0);
    expect(listBillOccurrences([one], new Date(2026, 10, 1), new Date(2026, 10, 30))).toHaveLength(0);
  });

  it("a one-time bill never reaches the monthly clamp", () => {
    // The trap this whole slice had to avoid: getBillDueDate does not reject
    // null, it silently returns the LAST DAY OF THE PREVIOUS MONTH, because
    // `null > last` is false and `new Date(y, m, null)` is day 0 of the month.
    const wrongMonth = getBillDueDate(null as unknown as number, 2026, 8);
    expect(wrongMonth.getMonth(), "the clamp is NOT null-safe, which is why the branch comes first").toBe(7);
    expect(wrongMonth.getDate()).toBe(31);

    // So: a one-time bill with a NULL day must still land on its own date.
    const one = bill({ day_of_month: null, due_date: "2026-10-05" });
    const occ = listBillOccurrences([one], oct(1), oct(31));
    expect(occ[0].dueDate).toBe("2026-10-05");
  });

  it("classifies the two kinds, and a template is neither", () => {
    expect(isOneTimeBill(bill({ day_of_month: null, due_date: "2026-10-05" }))).toBe(true);
    expect(isOneTimeBill(bill({ day_of_month: 5, due_date: null }))).toBe(false);
    // An unfilled onboarding template has no schedule at all: not on the money
    // surfaces, and refused by pay_bill. That state must stay creatable.
    const template = bill({ day_of_month: null, due_date: null });
    expect(isOneTimeBill(template)).toBe(false);
    expect(isBillOnMoneySurfaces(template)).toBe(false);
    // ...and a one-time bill IS on the money surfaces despite having no day,
    // which is the assertion that would have failed if isBillOnMoneySurfaces
    // had kept requiring day_of_month.
    expect(isBillOnMoneySurfaces(bill({ day_of_month: null, due_date: "2026-10-05" }))).toBe(true);
  });

  it("a recurring bill is unchanged, including the short-month clamp", () => {
    const rent = bill({ day_of_month: 31, due_date: null });
    const feb = listBillOccurrences([rent], new Date(2027, 1, 1), new Date(2027, 1, 28));
    expect(feb).toHaveLength(1);
    expect(feb[0].dueDate).toBe("2027-02-28");
  });

  it("accepts a template, either kind, and refuses both at once", () => {
    // No schedule: an onboarding template. Still valid.
    expect(billInputSchema.safeParse({ name: "SSS Contribution" }).success).toBe(true);
    // Day only: recurring.
    expect(billInputSchema.safeParse({ name: "Rent", day_of_month: 5 }).success).toBe(true);
    // Date only: one-time.
    expect(billInputSchema.safeParse({ name: "Repair", due_date: "2026-10-05" }).success).toBe(true);
    // Both: a bill scheduled two ways at once. Refused.
    const both = billInputSchema.safeParse({ name: "Confused", day_of_month: 5, due_date: "2026-10-05" });
    expect(both.success).toBe(false);
  });

  it("an inactive or amount-less bill stays off the surfaces, whichever kind it is", () => {
    expect(isBillOnMoneySurfaces(bill({ day_of_month: null, due_date: "2026-10-05", active: false }))).toBe(false);
    expect(isBillOnMoneySurfaces(bill({ day_of_month: null, due_date: "2026-10-05", expected_amount: null }))).toBe(false);
  });
});
