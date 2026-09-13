import { describe, it, expect } from "vitest";
import { dueSoonKey } from "@/lib/utils/bills";

describe("due-soon notification key stability (spec §8)", () => {
  it("same qualifying set ⇒ same key", () => {
    const a = [{ bill_id: "1", dueDate: "2026-09-15", expectedAmount: 100 }];
    expect(dueSoonKey(a)).toBe(dueSoonKey(a));
  });
  it("bill paid (exits) / new entry / amount edit ⇒ new key", () => {
    const base = [{ bill_id: "1", dueDate: "2026-09-15", expectedAmount: 100 }];
    expect(dueSoonKey(base)).not.toBe(dueSoonKey([]));
    expect(dueSoonKey(base)).not.toBe(dueSoonKey([{ bill_id: "2", dueDate: "2026-09-18", expectedAmount: 500 }]));
    expect(dueSoonKey(base)).not.toBe(dueSoonKey([{ bill_id: "1", dueDate: "2026-09-15", expectedAmount: 250 }]));
  });
});