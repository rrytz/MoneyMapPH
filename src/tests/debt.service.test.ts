import { describe, it, expect } from "vitest";
import {
  getDebts,
  createDebt,
  updateDebt,
  deleteDebt,
  getDebtPayment,
} from "@/lib/services/debt.service";

type Row = Record<string, unknown>;

type QueryStub = {
  eq: (k: string, v: unknown) => QueryStub;
  order: (k: string) => QueryStub;
  in: (k: string, v: string[]) => QueryStub;
  select: () => QueryStub;
  maybeSingle: () => Promise<{ data: Row | null; error: null }>;
  single: () => Promise<{ data: Row | null; error: null }>;
  insert: () => QueryStub;
  update: () => QueryStub;
  delete: () => QueryStub;
  then: (resolve: (v: unknown) => unknown) => Promise<unknown>;
};

function clientStub(rows: Record<string, Row[]>) {
  const calls: string[] = [];
  const build = (table: string, filters: Row): QueryStub => {
    const matches = (r: Row) =>
      Object.entries(filters).every(([k, v]) => v === undefined || r[k] === v);
    const list = () => (rows[table] ?? []).filter(matches);
    const q: QueryStub = {
      eq: (k: string, v: unknown) => {
        calls.push(`eq:${k}=${v}`);
        return build(table, { ...filters, [k]: v });
      },
      order: (k: string) => {
        calls.push(`order:${k}`);
        return q;
      },
      in: (k: string, v: string[]) => {
        calls.push(`in:${k}=${v.length}`);
        return q;
      },
      select: () => q,
      maybeSingle: async () => ({ data: list()[0] ?? null, error: null }),
      single: async () => ({ data: list()[0] ?? null, error: null }),
      insert: () => {
        calls.push(`insert:${table}`);
        return q;
      },
      update: () => {
        calls.push(`update:${table}`);
        return q;
      },
      delete: () => {
        calls.push(`delete:${table}`);
        return q;
      },
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: list(), error: null }).then(resolve),
    };
    return q;
  };
  return {
    from: (t: string) => {
      calls.push(`from:${t}`);
      return build(t, {});
    },
    calls,
  };
}

describe("getDebts", () => {
  it("returns debts + payments for the user, debts ordered by due_date", async () => {
    const rows = {
      debts: [
        { id: "d1", user_id: "u1", total_amount: "20000", due_date: "2026-10-30" },
        { id: "d2", user_id: "u2", total_amount: "100", due_date: "2026-09-01" },
      ],
      debt_payments: [{ id: "p1", debt_id: "d1", amount: "5000", paid_at: "2026-09-18" }],
    };
    const s = clientStub(rows) as never;
    const view = await getDebts(s, "u1");
    expect(view.debts.map((d) => d.id)).toEqual(["d1"]);
    expect(view.payments).toHaveLength(1);
    expect((s as unknown as { calls: string[] }).calls).toContain("from:debt_payments");
  });

  it("skips the payments query entirely when the user has no debts", async () => {
    const rows = { debts: [{ id: "d9", user_id: "ux" }], debt_payments: [] };
    const s = clientStub(rows) as never;
    const view = await getDebts(s, "u1");
    expect(view.debts).toHaveLength(0);
    expect(view.payments).toEqual([]);
    expect((s as unknown as { calls: string[] }).calls.filter((c) => c === "from:debt_payments")).toHaveLength(0);
  });
});

describe("createDebt", () => {
  it("inserts a user-scoped debt", async () => {
    const rows = { debts: [] };
    const s = clientStub(rows) as never;
    await expect(
      createDebt(s, "u1", { name: "Loan", total_amount: 20000, due_date: "2026-10-30", category_id: null, notes: null })
    ).resolves.toBeDefined();
  });
});

describe("updateDebt", () => {
  it("rejects a total below the already-paid sum", async () => {
    const rows = {
      debts: [],
      debt_payments: [
        { id: "p1", debt_id: "d1", amount: "5000" },
        { id: "p2", debt_id: "d1", amount: "7000" },
      ],
    };
    const s = clientStub(rows) as never;
    await expect(updateDebt(s, "u1", "d1", { total_amount: 10000 })).rejects.toThrow("TOTAL_BELOW_PAID");
  });

  it("allows a total above the paid sum", async () => {
    const rows = { debts: [], debt_payments: [{ id: "p1", debt_id: "d1", amount: "3000" }] };
    const s = clientStub(rows) as never;
    await expect(updateDebt(s, "u1", "d1", { total_amount: 15000 })).resolves.toBeDefined();
  });
});

describe("deleteDebt", () => {
  it("issues a user-scoped delete", async () => {
    const rows = { debts: [] };
    const s = clientStub(rows) as never;
    await deleteDebt(s, "u1", "d1");
    expect((s as unknown as { calls: string[] }).calls).toContain("eq:id=d1");
    expect((s as unknown as { calls: string[] }).calls).toContain("eq:user_id=u1");
  });
});

describe("getDebtPayment", () => {
  it("returns null when the payment is not owned", async () => {
    const rows = {
      debt_payments: [{ id: "p1", debt_id: "d1", paid_at: "2026-09-18", amount: "5000" }],
      debts: [
        { id: "d1", user_id: "uX" },
        { id: "d2", user_id: "u1" },
      ],
    };
    const s = clientStub(rows) as never;
    await expect(getDebtPayment(s, "u1", "p1")).resolves.toBeNull();
  });

  it("returns the payment when owned", async () => {
    const rows = {
      debt_payments: [{ id: "p1", debt_id: "d1", paid_at: "2026-09-18", amount: "5000" }],
      debts: [{ id: "d1", user_id: "u1" }],
    };
    const s = clientStub(rows) as never;
    const p = await getDebtPayment(s, "u1", "p1");
    expect(p?.paid_at).toBe("2026-09-18");
  });

  it("returns null when the payment row does not exist", async () => {
    const s = clientStub({ debt_payments: [], debts: [] }) as never;
    await expect(getDebtPayment(s, "u1", "nope")).resolves.toBeNull();
  });
});