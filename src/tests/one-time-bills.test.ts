import { describe, expect, it } from "vitest";
import { listBillOccurrences, isBillOnMoneySurfaces, isOneTimeBill, getBillDueDate, visibleCalendarOccurrences } from "@/lib/utils/bills";
import { billInputSchema } from "@/lib/utils/validators";
import type { Bill, BillOccurrence } from "@/lib/types";

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

  // The regression. These payloads are COPIED FROM WHAT THE FORM SENDS, with
  // the empty strings the controlled inputs produce. The tests above omit the
  // unused key instead, and that difference is the entire bug: every optional
  // field takes z.literal("") as its absent sentinel, so the refine has to
  // treat "" as absent. It tested `!= null`, and `"" != null` is true - so it
  // saw an empty day_of_month as a schedule and refused every one-time bill the
  // UI tried to create, with a message about being scheduled two ways at once.
  //
  // A schema test that tidies its input away from the real caller's shape will
  // pass while the feature is broken.
  it("accepts the EXACT payload a one-time bill form sends", () => {
    const res = billInputSchema.safeParse({
      name: "ZZ d2 onetime",
      expected_amount: 275,
      category_id: "",
      day_of_month: "",
      due_date: "2026-09-22",
    });
    expect(res.success, res.success ? "" : JSON.stringify(res.error.issues)).toBe(true);
    // And the parsed value keeps the sentinel as a string, which the action
    // then converts to null.
    expect(res.success && res.data.day_of_month).toBe("");
    expect(res.success && res.data.due_date).toBe("2026-09-22");
  });

  it("accepts the EXACT payload a recurring bill form sends", () => {
    const res = billInputSchema.safeParse({
      name: "Rent",
      expected_amount: 12000,
      category_id: "",
      day_of_month: 5,
      due_date: "",
    });
    expect(res.success, res.success ? "" : JSON.stringify(res.error.issues)).toBe(true);
  });

  it("still refuses a bill whose TWO schedules are both genuinely filled in", () => {
    // The fix must not weaken the rule into uselessness: two real values is
    // still a contradiction, and "" is the only thing that counts as absent.
    const both = billInputSchema.safeParse({
      name: "Confused", category_id: "", day_of_month: 5, due_date: "2026-10-05",
    });
    expect(both.success).toBe(false);
  });

  it("an inactive or amount-less bill stays off the surfaces, whichever kind it is", () => {
    expect(isBillOnMoneySurfaces(bill({ day_of_month: null, due_date: "2026-10-05", active: false }))).toBe(false);
    expect(isBillOnMoneySurfaces(bill({ day_of_month: null, due_date: "2026-10-05", expected_amount: null }))).toBe(false);
  });

  // Both directions, because the rule only means something if it distinguishes
  // the two kinds. A filter that dropped every paid bill would pass a test that
  // only checked "paid one-time disappears".
  it("a paid ONE-TIME bill leaves the calendar; a paid RECURRING one stays", () => {
    const oneTimeId = "one";
    const recurringId = "rec";
    // The occurrence carries its own kind. Nothing downstream re-derives it from
    // the bill, which is the whole point of putting it here.
    const occs: BillOccurrence[] = [
      { bill_id: oneTimeId, billName: "Repair", dueDate: "2026-10-05", expectedAmount: 500, cutoffPeriodEnd: "2026-10-15", oneTime: true },
      { bill_id: recurringId, billName: "Rent", dueDate: "2026-10-05", expectedAmount: 12000, cutoffPeriodEnd: "2026-10-15", oneTime: false },
    ];
    const paidBoth = new Set([`${oneTimeId}|2026-10-05`, `${recurringId}|2026-10-05`]);

    const afterPaying = visibleCalendarOccurrences(occs, paidBoth);
    // The one-time bill is gone...
    expect(afterPaying.map((o) => o.bill_id)).toEqual([recurringId]);
    // ...and the recurring one is still there, so its tick can render. Same
    // payment state, different outcome, decided only by which kind of bill it is.
    expect(afterPaying[0].billName).toBe("Rent");

    // Unpaid: both show.
    expect(visibleCalendarOccurrences(occs, new Set())).toHaveLength(2);
  });

  it("a one-time bill paid under a DIFFERENT date is not treated as paid", () => {
    // The key is bill_id|due_date, and a one-time bill has exactly one date, so
    // this is nearly impossible in practice - but it is the shape that would
    // make a bill vanish for a payment that was never its own.
    const occs: BillOccurrence[] = [
      { bill_id: "one", billName: "Repair", dueDate: "2026-10-05", expectedAmount: 500, cutoffPeriodEnd: "2026-10-15", oneTime: true },
    ];
    const paidOtherDate = visibleCalendarOccurrences(occs, new Set(["one|2026-11-05"]));
    expect(paidOtherDate).toHaveLength(1);
  });

  it("every occurrence states its own kind, from the bill it came from", () => {
    // The centralisation, pinned. One-time is computed once in toOccurrence and
    // travels with the occurrence, so a surface cannot render "one-time" from a
    // different derivation than the one the filter uses.
    const oneTime = listBillOccurrences(
      [bill({ id: "o", day_of_month: null, due_date: "2026-10-05" })],
      oct(1), oct(31)
    );
    const recurring = listBillOccurrences(
      [bill({ id: "r", day_of_month: 5, due_date: null })],
      oct(1), oct(31)
    );
    expect(oneTime[0].oneTime).toBe(true);
    expect(recurring[0].oneTime).toBe(false);
    // A template is not on the surfaces at all, so it never produces one.
    expect(listBillOccurrences([bill({ day_of_month: null, due_date: null })], oct(1), oct(31))).toHaveLength(0);
  });
});
