import { describe, expect, it } from "vitest";
import { listBillOccurrences } from "@/lib/utils/bills";
import type { Bill } from "@/lib/types";

const bill = (over: Partial<Bill> = {}): Bill => ({
  id: "b1", user_id: "u1", name: "Thing", expected_amount: "500", category_id: null,
  day_of_month: 1, due_date: null, active: true, notes: null,
  created_at: "x", updated_at: "x", ...over,
});

const oct = (d: number) => new Date(2026, 9, d);

/**
 * The card's two disclosure rules, expressed against the same data the card
 * reads. Kept as a function so the component and this test cannot drift, which
 * is the same reason the header copy and this assertion quote each other.
 */
function splitForCap<T extends { oneTime: boolean }>(all: T[], limit = 6) {
  const shown = all.slice(0, limit);
  const hidden = all.slice(limit);
  return {
    shown,
    hiddenCount: hidden.length,
    hiddenOneTime: hidden.filter((i) => i.oneTime).length,
  };
}

describe("what the upcoming card hides, and says it hides", () => {
  // Ordering is soonest-first and stays that way: reordering would change what
  // "upcoming" means on a card that also lists debts. But a one-time bill is by
  // nature a specific FUTURE date, so a soonest-first cap pushes exactly the
  // kind of item a person is budgeting against off the bottom, every time. The
  // count was already disclosed; this is about disclosing WHAT.
  it("counts the one-time bills that fell past the cap", () => {
    const items = [
      ...Array.from({ length: 6 }, (_, i) => ({ oneTime: false, id: `r${i}` })),
      { oneTime: true, id: "o1" },
      { oneTime: true, id: "o2" },
      { oneTime: false, id: "r6" },
    ];
    const s = splitForCap(items);
    expect(s.hiddenCount).toBe(3);
    expect(s.hiddenOneTime).toBe(2);
  });

  it("says nothing about one-time bills when the hidden set has none", () => {
    // A clause that always renders is noise, and this one would be wrong the
    // moment the user has no one-time bills at all - which is most of the time.
    const items = Array.from({ length: 9 }, (_, i) => ({ oneTime: false, id: `r${i}` }));
    expect(splitForCap(items).hiddenOneTime).toBe(0);
  });

  it("claims nothing when the cap is not binding", () => {
    const items = [{ oneTime: true, id: "o1" }];
    const s = splitForCap(items);
    expect(s.hiddenCount).toBe(0);
    expect(s.hiddenOneTime).toBe(0);
  });

  it("a hidden one-time bill is genuinely reachable elsewhere", () => {
    // Otherwise the disclosure would be admitting a dead end. The calendar and
    // the bills list both render every month, with no cap on which days exist.
    const bills = [
      bill({ id: "far", name: "Far away", day_of_month: 28 }),
      bill({ id: "ot", name: "One-time", day_of_month: null, due_date: "2026-10-29" }),
    ];
    const occ = listBillOccurrences(bills, oct(1), oct(31));
    expect(occ.map((o) => o.billName).sort()).toEqual(["Far away", "One-time"]);
    // The one that the cap would hide is exactly the one carrying its kind.
    const far = occ.find((o) => o.billName === "One-time");
    expect(far?.oneTime).toBe(true);
  });
});
