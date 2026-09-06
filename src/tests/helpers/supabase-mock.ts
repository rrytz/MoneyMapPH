import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a minimal Supabase client mock.
 * Pass `rows` to control what `.select()` queries return.
 * You can override specific table responses by passing a map:
 *   createSupabaseMock({ income_entries: [...], expenses: [...] })
 */
export function createSupabaseMock(
  tableData: Record<string, unknown[]> = {}
): SupabaseClient {
  const makeQuery = (data: unknown[], error: null | object = null) => {
    const q = {
      data,
      error,
      count: data.length,
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
      maybeSingle: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: (v: unknown) => void) =>
        resolve({ data, error, count: data.length })
      ),
    };
    // Make it thenable so `await query` works
    Object.defineProperty(q, Symbol.toStringTag, { value: "Promise" });
    return q;
  };

  const fromMock = vi.fn((table: string) => {
    const data = tableData[table] ?? [];
    return makeQuery(data);
  });

  return {
    from: fromMock,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "test-user-id" } }, error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
  } as unknown as SupabaseClient;
}
