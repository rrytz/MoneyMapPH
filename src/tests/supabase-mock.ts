import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

export function makeQueryBuilder(rows: unknown[], count = 0) {
  const result = { data: rows, error: null, count };
  const q: Record<string, unknown> = {
    data: rows,
    error: null,
    count,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn((column: string, value: unknown) => {
      result.data = (result.data as Record<string, unknown>[]).filter((r) =>
        value === null ? r[column] == null : r[column] === value
      );
      return q;
    }),
    in: vi.fn((column: string, values: unknown[]) => {
      result.data = (result.data as Record<string, unknown>[]).filter((r) =>
        values.includes(r[column])
      );
      return q;
    }),
    insert: vi.fn((row: unknown) => {
      result.data = [{ id: "n1", ...(row as object) }, ...(result.data as unknown[])];
      q.data = result.data;
      return q;
    }),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(() =>
      Promise.resolve({ data: (result.data as unknown[])[0] ?? null, error: null })
    ),
    single: vi.fn(() =>
      Promise.resolve({ data: (result.data as unknown[])[0] ?? null, error: null })
    ),
    then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
  };
  return q;
}

export function makeSupabase(tables: Record<string, unknown[]>): SupabaseClient {
  return {
    from: vi.fn((table: string) => makeQueryBuilder(tables[table] ?? [])),
  } as unknown as SupabaseClient;
}
