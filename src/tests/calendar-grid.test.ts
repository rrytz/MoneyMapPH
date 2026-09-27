import { describe, expect, it } from "vitest";
import { buildCalendarCells } from "@/lib/utils/calendar-cells";
import { listBillOccurrences, getBillDueDate } from "@/lib/utils/bills";
import type { Bill } from "@/lib/types";

const bill = (over: Partial<Bill> = {}): Bill => ({
  id: "b1", user_id: "u1", name: "Thing", expected_amount: "500", category_id: null,
  day_of_month: 1, due_date: null, active: true, notes: null,
  created_at: "x", updated_at: "x", ...over,
});

const noPayments: never[] = [];

describe("the grid is always whole rows", () => {
  // The bug this pins: days ran from the leading pad to the end of the month and
  // no further, so the cell count was whatever the month happened to span. A
  // 7-column grid needs a multiple of 7 - September 2026 produced 31 cells
  // (3 in the last row) and October produced 34 (6 in the last row), leaving
  // ragged gaps and pushing cells out of their weekday columns.
  for (const [y, m] of [[2026, 8], [2026, 9], [2026, 0], [2026, 1], [2027, 1], [2026, 11]] as const) {
    it(`${y}-${String(m + 1).padStart(2, "0")} is a multiple of 7`, () => {
      const cells = buildCalendarCells(y, m, [], noPayments, "2026-09-28");
      expect(cells.length % 7, `${cells.length} cells`).toBe(0);
      expect(cells.length).toBeGreaterThanOrEqual(28);
    });
  }

  it("pads both ends and still contains every day of the month exactly once", () => {
    const cells = buildCalendarCells(2026, 9, [], noPayments, "2026-09-28"); // October 2026
    const inMonth = cells.filter((c) => c.isInMonth);
    expect(inMonth).toHaveLength(31); // October has 31 days
    expect(new Set(inMonth.map((c) => c.date)).size).toBe(31);
    // Leading padding is before the 1st, trailing padding is after the last.
    expect(cells[0].isInMonth).toBe(false);
    expect(cells[cells.length - 1].isInMonth).toBe(false);
    // October 1 2026 is a Thursday, so the grid starts on Mon Sep 28.
    expect(cells[0].date).toBe("2026-09-28");
    expect(cells[3].date).toBe("2026-10-01");
  });

  it("each day lands in the weekday column the header names", () => {
    const cells = buildCalendarCells(2026, 9, [], noPayments, "2026-09-28");
    cells.forEach((c, i) => {
      // Monday-start: getDay() 1 (Mon) -> column 0, 0 (Sun) -> column 6.
      const col = (new Date(`${c.date}T00:00:00`).getDay() + 6) % 7;
      expect(col, `${c.date} at index ${i}`).toBe(i % 7);
    });
  });
});

describe("occurrences for the month being VIEWED (not the month served)", () => {
  // The defect: `occurrences` came from the server as a prop scoped to the
  // page's initial month, and nothing refetched it when viewMonth changed. The
  // header and the grid moved; the data stayed. October showed September's
  // bills on September's leading cells and nothing else, and November showed
  // nothing at all - which is what distinguishes "never refetched" from a
  // month-index bug, since a shifted index would have carried October's bills
  // into November.
  const bills = [
    bill({ id: "a", name: "Rent", day_of_month: 1 }),
    bill({ id: "b", name: "Internet", day_of_month: 5 }),
    bill({ id: "c", name: "Repair", day_of_month: null, due_date: "2026-10-20" }),
  ];

  const inMonth = (iso: string, occurrences: ReturnType<typeof listBillOccurrences>) =>
    occurrences.filter((o) => o.dueDate.startsWith(iso));

  it("each month's own occurrences, computed from the bills", () => {
    const sept = listBillOccurrences(bills, new Date(2026, 8, 1), new Date(2026, 8, 30));
    const oct = listBillOccurrences(bills, new Date(2026, 9, 1), new Date(2026, 9, 31));
    const nov = listBillOccurrences(bills, new Date(2026, 10, 1), new Date(2026, 11, 0));

    expect(sept.map((o) => o.billName).sort()).toEqual(["Internet", "Rent"]);
    expect(oct.map((o) => o.billName).sort()).toEqual(["Internet", "Rent", "Repair"]);
    // November: the recurring bills recur, the one-time does not.
    expect(nov.map((o) => o.billName).sort()).toEqual(["Internet", "Rent"]);
    // The one-time bill appears in exactly one month, and it is October.
    expect(inMonth("2026-10", oct).filter((o) => o.billName === "Repair")).toHaveLength(1);
    expect(inMonth("2026-09", sept).filter((o) => o.billName === "Repair")).toHaveLength(0);
    expect(inMonth("2026-11", nov).filter((o) => o.billName === "Repair")).toHaveLength(0);
  });

  it("a recurring bill keeps its day-of-month across the month boundary", () => {
    const rent = bill({ id: "r", day_of_month: 31, due_date: null });
    // Oct 31 exists; Nov 31 does not, so it clamps to Nov 30 - which is the
    // clamp working, not the month being wrong.
    expect(getBillDueDate(31, 2026, 9).getDate()).toBe(31);
    expect(getBillDueDate(31, 2026, 10).getDate()).toBe(30);
    const oct = listBillOccurrences([rent], new Date(2026, 9, 1), new Date(2026, 9, 31));
    const nov = listBillOccurrences([rent], new Date(2026, 10, 1), new Date(2026, 11, 30));
    expect(inMonth("2026-10", oct)[0]?.dueDate).toBe("2026-10-31");
    expect(inMonth("2026-11", nov)[0]?.dueDate).toBe("2026-11-30");
  });

  it("the cells for a month show that month's occurrences, on the right days", () => {
    const octOcc = listBillOccurrences(bills, new Date(2026, 9, 1), new Date(2026, 9, 31));
    const cells = buildCalendarCells(2026, 9, octOcc, noPayments, "2026-09-28");
    const withChips = cells.filter((c) => c.occurrences.length > 0);
    expect(withChips.map((c) => c.date)).toEqual(["2026-10-01", "2026-10-05", "2026-10-20"]);
    // ...and the leading September padding carries none of them.
    expect(cells.filter((c) => !c.isInMonth).every((c) => c.occurrences.length === 0)).toBe(true);
  });
});
