import { describe, expect, it } from "vitest";
import {
  billDraftForDate,
  billSchedule,
  emptyBillDraft,
  billDraftFrom,
  type BillDraft,
} from "@/lib/utils/bill-draft";
import type { Bill } from "@/lib/types";

const bill = (over: Partial<Bill> = {}): Bill => ({
  id: "b1", user_id: "u1", name: "Rent", expected_amount: "12000", category_id: null,
  day_of_month: 1, due_date: null, active: true, notes: null,
  created_at: "x", updated_at: "x", ...over,
});

const draft = (over: Partial<BillDraft> = {}): BillDraft => ({ ...emptyBillDraft(), ...over });

describe("the clicked-date contract", () => {
  // Direction 1: the click sets BOTH.
  it("a clicked date sets due_date AND forces the toggle off, together", () => {
    const d = billDraftForDate("2026-09-15");
    // Both halves, asserted separately, because either one alone is the bug.
    expect(d.due_date).toBe("2026-09-15");
    expect(d.repeats).toBe(false);
    // And the consequence: the date is what gets sent.
    expect(billSchedule(d)).toEqual({ day_of_month: "", due_date: "2026-09-15" });
  });

  // Direction 2: the failure mode is real, and this is what it produces.
  // If this test ever stops describing reality, the hazard above is fictional.
  it("WITHOUT the toggle-off, a clicked date is silently discarded", () => {
    const broken = draft({ due_date: "2026-09-15", repeats: true });
    expect(broken.due_date).toBe("2026-09-15");
    // The date is in the draft and still does not survive the trip.
    expect(billSchedule(broken)).toEqual({ day_of_month: "", due_date: "" });
    // Result: a schedule-less template. Not a bill on the 15th, and not an
    // error - it is created, and it renders badged "Incomplete".
    const s = billSchedule(broken);
    expect(s.day_of_month).toBe("");
    expect(s.due_date).toBe("");
  });

  it("there is no way to build a dated draft through any other door", () => {
    // emptyBillDraft must not already carry a date, or "the click sets both"
    // would be an accident of the default rather than a contract.
    expect(emptyBillDraft().due_date).toBe("");
    expect(emptyBillDraft().repeats).toBe(true);
    // billDraftForDate is the single producer of a one-time draft.
    expect(billDraftForDate("2026-10-01").repeats).toBe(false);
  });
});

describe("clause 2: flipping the toggle after a click", () => {
  it("drops the date and leaves an empty day input - visibly a template", () => {
    const clicked = billDraftForDate("2026-09-15");
    // The user changes their mind and switches to monthly.
    const flipped: BillDraft = { ...clicked, repeats: true };
    // The date is no longer sent, even though it is still sitting in the draft.
    expect(billSchedule(flipped)).toEqual({ day_of_month: "", due_date: "" });
    // ...and the day input is genuinely empty, so the form cannot submit a
    // number the user never typed.
    expect(flipped.day_of_month).toBe("");
  });

  it("a recurring bill with no day is a template, which is a legal state", () => {
    // Onboarding seeds exactly this. Requiring a schedule would break seeding.
    expect(billSchedule(draft({ repeats: true }))).toEqual({ day_of_month: "", due_date: "" });
  });
});

describe("clause 3: one creation path", () => {
  it("editing a stored bill reads its kind off the row, not the toggle default", () => {
    expect(billDraftFrom(bill({ day_of_month: 5, due_date: null })).repeats).toBe(true);
    expect(billDraftFrom(bill({ day_of_month: null, due_date: "2026-10-05" })).repeats).toBe(false);
    // A template reads as recurring (the default), and saving it unchanged
    // stays a template rather than acquiring a day nobody typed.
    expect(billDraftFrom(bill({ day_of_month: null, due_date: null }))).toMatchObject({
      repeats: true, day_of_month: "", due_date: "",
    });
  });

  it("never submits both schedules at once", () => {
    for (const d of [
      draft({ repeats: true, day_of_month: "5", due_date: "2026-09-15" }),
      draft({ repeats: false, day_of_month: "5", due_date: "2026-09-15" }),
    ]) {
      const s = billSchedule(d);
      const set = [s.day_of_month !== "", s.due_date !== ""].filter(Boolean).length;
      expect(set, "exactly one schedule field may be sent").toBeLessThanOrEqual(1);
    }
  });
});
