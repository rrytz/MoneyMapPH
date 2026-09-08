import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createPaycheck } from "@/lib/services/paycheck.service";

function makeSupabase(): { supabase: SupabaseClient; insertCalls: Array<Record<string, unknown>> } {
  const insertCalls: Array<Record<string, unknown>> = [];
  const supabase = {
    from: vi.fn(() => ({
      insert: vi.fn((row: Record<string, unknown>) => {
        insertCalls.push(row);
        return { select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { ...row, id: "pc-1" }, error: null }) }) };
      }),
    })),
  } as unknown as SupabaseClient;
  return { supabase, insertCalls };
}

describe("createPaycheck", () => {
  const USER_ID = "user-123";

  it("persists the explicit period_end when provided", async () => {
    const { supabase, insertCalls } = makeSupabase();
    await createPaycheck(supabase, USER_ID, {
      name: "Sep 13 cutoff",
      amount: 15000,
      date: "2026-09-11",
      allocations: [],
      period_end: "2026-09-13",
    });
    expect(insertCalls[0].period_end).toBe("2026-09-13");
  });

  it("defaults period_end to the cutoff containing the pay date", async () => {
    const { supabase, insertCalls } = makeSupabase();
    await createPaycheck(supabase, USER_ID, {
      name: "Sep 13 cutoff",
      amount: 15000,
      date: "2026-09-11",
      allocations: [],
    });
    expect(insertCalls[0].period_end).toBe("2026-09-13");
  });

  it("maps a 29th pay date to the next month's 13th cutoff", async () => {
    const { supabase, insertCalls } = makeSupabase();
    await createPaycheck(supabase, USER_ID, {
      name: "Dec 29 extra",
      amount: 15000,
      date: "2026-12-29",
      allocations: [],
    });
    expect(insertCalls[0].period_end).toBe("2027-01-13");
  });
});
