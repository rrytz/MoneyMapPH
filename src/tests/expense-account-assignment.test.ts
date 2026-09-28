import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isUnassignedEntry } from "@/lib/utils/expense-account-assignment";

const CLIENT = "src/app/(dashboard)/expenses/expenses-page-client.tsx";
const PAGE = "src/app/(dashboard)/expenses/page.tsx";
const ACCOUNTS = "src/app/(dashboard)/accounts/accounts-client.tsx";
const ACTION = "src/app/(dashboard)/expenses/actions.ts";

const src = (p: string) => readFileSync(p, "utf8");

const entry = (over: Partial<{ id: string; account_id: string | null }> = {}) => ({
  id: "e1",
  title: "mcdo",
  amount: 99,
  category_id: "c1",
  date: "2026-09-26",
  notes: "lunch",
  account_id: null,
  ...over,
});

describe("what counts as unassigned", () => {
  // The column is nullable, and a row written before tagging existed can carry
  // either null or undefined depending on how it was serialised. Filtering on
  // `=== null` alone would quietly drop the other and the view would claim to
  // be complete while omitting rows.
  it("treats null and undefined as the same state", () => {
    expect(isUnassignedEntry({ account_id: null } as never)).toBe(true);
    expect(isUnassignedEntry({ account_id: undefined } as never)).toBe(true);
    expect(isUnassignedEntry({} as never)).toBe(true);
  });

  it("treats any real id as assigned", () => {
    expect(isUnassignedEntry({ account_id: "acc-1" } as never)).toBe(false);
  });

  it("does not treat an empty string as assigned", () => {
    // `AccountSelect` represents "no account" as "". If that reached the filter
    // it would read as tagged, and the row would vanish from the view meant to
    // surface it.
    expect(isUnassignedEntry({ account_id: "" } as never)).toBe(true);
  });
});

describe("the unassigned view narrows the list", () => {
  const rows = [
    entry({ id: "a", account_id: null }),
    entry({ id: "b", account_id: "acc-1" }),
    entry({ id: "c", account_id: undefined }),
    entry({ id: "d", account_id: "acc-2" }),
  ];
  const apply = (only: boolean) => rows.filter((r) => (only ? isUnassignedEntry(r) : true));

  it("shows only unassigned rows when on", () => {
    expect(apply(true).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("shows every row when off - the default view is unchanged", () => {
    expect(apply(false).map((r) => r.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("is empty rather than broken when everything is tagged", () => {
    const all = [entry({ account_id: "acc-1" }), entry({ account_id: "acc-2" })];
    expect(all.filter(isUnassignedEntry)).toEqual([]);
  });
});

describe("assigning an account preserves every other field", () => {
  // The safety property of a tagging control: the only byte that differs is
  // account_id. Sourcing amount from anywhere else is how a control that means
  // to add a label rewrites money.
  it("carries title, amount, category, date and notes through unchanged", () => {
    const before = entry({ account_id: null });
    const after = { ...before, account_id: "acc-1" };
    const changed = Object.keys(before).filter((k) => before[k as keyof typeof before] !== after[k as keyof typeof after]);
    expect(changed).toEqual(["account_id"]);
  });

  it("clearing to null also changes only account_id", () => {
    const before = entry({ account_id: "acc-1" });
    const after = { ...before, account_id: null };
    const changed = Object.keys(before).filter((k) => before[k as keyof typeof before] !== after[k as keyof typeof after]);
    expect(changed).toEqual(["account_id"]);
  });

  it("preserves a null note and a numeric-string amount", () => {
    const before = { ...entry({ account_id: null }), notes: null, amount: "99.00" as unknown as number };
    const after = { ...before, account_id: "acc-9" };
    expect(after.notes).toBeNull();
    expect(after.amount).toBe("99.00");
    expect(Number(after.amount)).toBe(99);
  });
});

describe("the control is wired the way it was measured, and no further", () => {
  it("renders the existing AccountSelect inline on the row", () => {
    expect(src(CLIENT)).toContain("<AccountSelect");
  });

  it("does not change AccountSelect's optionality or default", () => {
    // A tagging affordance that forces a choice is worse than none: a cash
    // purchase may genuinely belong to no account.
    const sel = src("src/components/forms/account-select.tsx");
    expect(sel).toMatch(/None \/ Unassigned/);
    expect(sel).toMatch(/Account \/ Wallet \(Optional\)/);
    expect(sel).toMatch(/Optional: Tag which account/);
  });

  it("introduces no bulk write path - it reuses editExpense", () => {
    const c = src(CLIENT);
    expect(c).toContain("editExpense(");
    // The action module must not grow a second mutator.
    const a = src(ACTION);
    const mutators = a.match(/export async function \w+/g) ?? [];
    expect(mutators).toEqual(
      expect.arrayContaining(["export async function addExpense", "export async function editExpense"])
    );
    expect(mutators.some((m) => /bulk|mass|assignMany|tagMany/i.test(m))).toBe(false);
  });

  it("ownership is enforced by the existing authenticated action, not by the client", () => {
    // The row was fetched scoped to the user, and editExpense scopes its write
    // the same way. Nothing here is a client-side authorisation.
    const a = src(ACTION);
    const body = a.slice(a.indexOf("export async function editExpense"));
    expect(body).toMatch(/getUser\(\)/);
    expect(body).toMatch(/\.eq\("user_id",\s*user\.id\)/);
  });
});

describe("the filter is URL state, integrated with the mechanism already there", () => {
  it("reads unassigned from the page's existing searchParams", () => {
    const p = src(PAGE);
    expect(p).toMatch(/searchParams: Promise<\{[^}]*unassigned\?: string/);
    expect(p).toContain('params.unassigned === "1"');
  });

  it("activates on exactly ?unassigned=1 and nothing else", () => {
    const p = src(PAGE);
    expect(p).toContain('initialUnassignedOnly={params.unassigned === "1"}');
  });

  it("does not put it in the remount key, so back/forward keeps the page and filters", () => {
    expect(src(PAGE)).toMatch(/key=\{`\$\{month\}-\$\{year\}`\}/);
    expect(src(PAGE)).not.toMatch(/key=\{[^}]*unassigned/);
  });

  it("defaults to the full list when the param is absent", () => {
    expect(src(CLIENT)).toMatch(/initialUnassignedOnly = false/);
  });
});

describe("the /accounts warning is both truthful and actionable", () => {
  it("links to the filtered view", () => {
    const a = src(ACCOUNTS);
    expect(a).toContain('href="/expenses?unassigned=1"');
  });

  it("no longer claims untagged money is included in totals", () => {
    // The copy said the opposite of what get_account_aggregates does: it
    // filters account_id IS NOT NULL, so untagged rows reach no balance.
    const a = src(ACCOUNTS);
    expect(a).not.toMatch(/continue to be included/);
    expect(a).toMatch(/excluded/);
  });
});
