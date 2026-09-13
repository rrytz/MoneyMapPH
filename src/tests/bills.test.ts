import { describe, it, expect } from "vitest";
import {
  isBillOnMoneySurfaces,
  getBillDueDate,
  listBillOccurrences,
  getNextPayoutDate,
  bucketCutoff,
  dueSoonKey,
  getBillsDueWindow,
} from "@/lib/utils/bills";
import type { Bill } from "@/lib/types";
import { toISODateString } from "@/lib/utils/date";

const readyActive = (over: Partial<Bill> = {}): Bill => ({
  id: "b1",
  user_id: "u1",
  name: "Rent",
  expected_amount: "12000",
  category_id: null,
  day_of_month: 1,
  active: true,
  notes: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("isBillOnMoneySurfaces", () => {
  it("true only when amount, day, and active are all set", () => {
    expect(isBillOnMoneySurfaces(readyActive())).toBe(true);
    expect(isBillOnMoneySurfaces(readyActive({ expected_amount: null }))).toBe(false);
    expect(isBillOnMoneySurfaces(readyActive({ day_of_month: null }))).toBe(false);
    expect(isBillOnMoneySurfaces(readyActive({ active: false }))).toBe(false);
    expect(isBillOnMoneySurfaces(readyActive({ expected_amount: null, day_of_month: null }))).toBe(false);
  });
});

describe("getBillDueDate", () => {
  it("clamps to the last day of the month", () => {
    expect(getBillDueDate(31, 2026, 3).getDate()).toBe(30); // April 2026
    expect(getBillDueDate(31, 2026, 1).getDate()).toBe(28); // Feb 2026 non-leap
    expect(getBillDueDate(29, 2028, 1).getDate()).toBe(29); // Feb 2028 leap
    expect(getBillDueDate(15, 2026, 6, ).getDate()).toBe(15); // July
  });
});

describe("listBillOccurrences", () => {
  it("emits one clamped occurrence per eligible bill in range", () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 2, 31);
    const occ = listBillOccurrences([readyActive()], start, end);
    expect(occ).toHaveLength(3);
    expect(occ[0]).toMatchObject({ bill_id: "b1", expectedAmount: 12000 });
    expect(occ[0].dueDate).toBe("2026-01-01");
    expect(occ[2].dueDate).toBe("2026-03-01");
  });
  it("NEVER emits occurrences for paused or incomplete bills (engine-enforced gate)", () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 1, 28);
    const bills = [
      readyActive(),
      readyActive({ id: "paused", active: false }),
      readyActive({ id: "no-day", day_of_month: null }),
      readyActive({ id: "no-amount", expected_amount: null }),
    ];
    const occ = listBillOccurrences(bills, start, end);
    expect(occ.every((o) => o.bill_id === "b1")).toBe(true);
  });
});

describe("getNextPayoutDate & bucketCutoff", () => {
  it("rolls weekends back to Friday via the V1 engine", () => {
    expect(toISODateString(getNextPayoutDate(new Date(2026, 8, 1)))).toBe("2026-09-11"); // cutoff 09-13 (Sun)
    expect(toISODateString(getNextPayoutDate(new Date(2026, 8, 14)))).toBe("2026-09-28");
  });
  it("buckets a due date into its cutoff", () => {
    expect(bucketCutoff(new Date(2026, 8, 5))).toBe("2026-09-13");
    expect(bucketCutoff(new Date(2026, 8, 20))).toBe("2026-09-28");
  });
});

describe("getBillsDueWindow", () => {
  it("K2-WINDOW: derives from=current cutoff periodStart and to=max(today+7, nextPayout)", () => {
    expect(getBillsDueWindow(new Date(2026, 8, 20))).toEqual({
      fromISO: "2026-09-14", // cutoff 09-14..09-28
      toISO: "2026-09-28", // nextPayout 09-28 (Mon) > today+7 09-27
    });
  });
  it("K2-WINDOW: mid-cutoff window caps at today+7 when nextPayout has already passed", () => {
    expect(getBillsDueWindow(new Date(2026, 8, 8))).toEqual({
      fromISO: "2026-08-29", // cutoff 08-29..09-13
      toISO: "2026-09-15", // nextPayout 09-11 (Fri) < today+7 09-15
    });
  });
  it("K2-WINDOW: Oct cutoff anchors on the 29th of the prior month", () => {
    expect(getBillsDueWindow(new Date(2026, 9, 5))).toEqual({
      fromISO: "2026-09-29", // cutoff 09-29..10-13
      toISO: "2026-10-13", // nextPayout 10-13 (Tue) > today+7 10-12
    });
  });
});

describe("dueSoonKey", () => {
  it("is stable for the same set regardless of order", () => {
    const a = dueSoonKey([{ bill_id: "1", dueDate: "2026-09-15", expectedAmount: 100 }]);
    const b = dueSoonKey([{ bill_id: "1", dueDate: "2026-09-15", expectedAmount: 100 }]);
    expect(a).toBe(b);
    expect(a.startsWith("bills-due-soon-")).toBe(true);
  });
  it("changes when content changes (paid exit, new entry, amount edit)", () => {
    const base = [{ bill_id: "1", dueDate: "2026-09-15", expectedAmount: 100 }];
    const without = dueSoonKey([]);
    const paid = dueSoonKey([{ bill_id: "2", dueDate: "2026-09-18", expectedAmount: 500 }]);
    const edited = dueSoonKey([{ bill_id: "1", dueDate: "2026-09-15", expectedAmount: 250 }]);
    expect(dueSoonKey(base)).not.toBe(without);
    expect(dueSoonKey(base)).not.toBe(paid);
    expect(dueSoonKey(base)).not.toBe(edited);
  });
});