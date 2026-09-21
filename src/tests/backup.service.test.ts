/**
 * Unit tests for the backup/restore service.
 *
 * The import body is a single plpgsql RPC (one transaction, upsert-merge,
 * FK parents-first) — that part is exercised by the live round-trip
 * verification, not unit tests. These tests cover the pure logic that sits
 * around it: the table manifest + ordering, file-format validation, and
 * ownership enforcement.
 */
import { describe, it, expect } from "vitest";
import {
  BACKUP_TABLES,
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  BACKUP_MAX_BYTES,
  buildBackupDocument,
  validateBackupFile,
  enforceBackupOwnership,
  isOwnerScopedTable,
  friendlyImportError,
  type BackupFile,
} from "@/lib/services/backup.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";

function validTables(): Record<string, unknown[]> {
  const tables: Record<string, unknown[]> = {
    accounts: [],
    income_sources: [],
    expense_categories: [],
    paychecks: [],
    budgets: [],
    savings_goals: [],
    bills: [],
    debts: [],
    simulated_purchases: [],
    reminders: [],
    paycheck_allocations: [],
    budget_categories: [],
    account_transfers: [],
    income_entries: [],
    bill_payments: [],
    debt_payments: [],
    monthly_snapshots: [],
  };
  tables.profiles = [{ id: USER_ID, display_name: "Owner" }];
  tables.expenses = [{ id: "e1", user_id: USER_ID, title: "Coffee" }];
  return tables;
}

function makeFile(overrides: Record<string, unknown> = {}): BackupFile {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: "2026-09-21T04:00:00.000Z",
    user: { id: USER_ID },
    tables: validTables(),
    ...overrides,
  };
}

describe("BACKUP_TABLES — manifest and FK-safe ordering", () => {
  it("contains exactly the 19 user tables in import order", () => {
    expect(BACKUP_TABLES).toEqual([
      "profiles",
      "accounts",
      "income_sources",
      "expense_categories",
      "paychecks",
      "budgets",
      "savings_goals",
      "bills",
      "debts",
      "simulated_purchases",
      "reminders",
      "paycheck_allocations",
      "budget_categories",
      "account_transfers",
      "income_entries",
      "expenses",
      "bill_payments",
      "debt_payments",
      "monthly_snapshots",
    ]);
  });

  it("orders every parent table before the children that reference it", () => {
    const idx = (t: (typeof BACKUP_TABLES)[number]) => BACKUP_TABLES.indexOf(t);
    const pairs: Array<[(typeof BACKUP_TABLES)[number], (typeof BACKUP_TABLES)[number]]> = [
      ["accounts", "account_transfers"],
      ["accounts", "income_entries"],
      ["accounts", "expenses"],
      ["income_sources", "income_entries"],
      ["expense_categories", "paycheck_allocations"],
      ["expense_categories", "budget_categories"],
      ["expense_categories", "expenses"],
      ["expense_categories", "bills"],
      ["expense_categories", "debts"],
      ["paychecks", "paycheck_allocations"],
      ["paychecks", "income_entries"],
      ["paychecks", "expenses"],
      ["budgets", "budget_categories"],
      ["savings_goals", "expenses"],
      ["bills", "bill_payments"],
      ["debts", "debt_payments"],
      ["expenses", "bill_payments"],
      ["expenses", "debt_payments"],
    ];
    for (const [parent, child] of pairs) {
      expect(idx(parent), `${parent} must precede ${child}`).toBeGreaterThanOrEqual(0);
      expect(idx(child), `${parent} must precede ${child}`).toBeGreaterThanOrEqual(0);
      expect(idx(parent)).toBeLessThan(idx(child));
    }
  });

  it("flags the user-scoped tables for ownership enforcement", () => {
    // Every table either carries user_id directly, is profiles (id = owner),
    // or is a child table whose ownership is enforced transitively.
    const expectedUserScoped = [
      "profiles",
      "accounts",
      "income_sources",
      "expense_categories",
      "paychecks",
      "budgets",
      "savings_goals",
      "bills",
      "debts",
      "simulated_purchases",
      "reminders",
      "account_transfers",
      "income_entries",
      "expenses",
      "monthly_snapshots",
    ];
    const manifest = BACKUP_TABLES.filter((t) => isOwnerScopedTable(t));
    expect(manifest).toEqual(expectedUserScoped);
  });
});

describe("buildBackupDocument", () => {
  it("assembles the documented shape with metadata", () => {
    const now = new Date("2026-09-21T04:00:00.000Z");
    const doc = buildBackupDocument(validTables(), USER_ID, now);
    expect(doc.format).toBe(BACKUP_FORMAT);
    expect(doc.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(doc.user).toEqual({ id: USER_ID });
    expect(doc.exportedAt).toBe("2026-09-21T04:00:00.000Z");
    expect(doc.tables).toEqual(validTables());
  });
});

describe("validateBackupFile", () => {
  it("accepts a well-formed backup", () => {
    const result = validateBackupFile(makeFile());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.format).toBe(BACKUP_FORMAT);
  });

  it("rejects a non-object payload", () => {
    expect(validateBackupFile(null).ok).toBe(false);
    expect(validateBackupFile("nope").ok).toBe(false);
    expect(validateBackupFile([]).ok).toBe(false);
  });

  it("rejects an unknown format marker", () => {
    const result = validateBackupFile(makeFile({ format: "something-else" }));
    expect(result.ok).toBe(false);
  });

  it("rejects an unsupported schemaVersion", () => {
    const result = validateBackupFile(makeFile({ schemaVersion: 99 as never }));
    expect(result.ok).toBe(false);
  });

  it("rejects a missing tables map", () => {
    const result = validateBackupFile(makeFile({ tables: undefined as never }));
    expect(result.ok).toBe(false);
  });

  it("rejects unknown table keys (no silent data gaps)", () => {
    const file = makeFile({
      tables: { ...validTables(), mystery_table: [{ a: 1 }] },
    });
    const result = validateBackupFile(file);
    expect(result.ok).toBe(false);
  });

  it("rejects a tables map that is missing required tables", () => {
    const file = makeFile({ tables: { profiles: [] } as never });
    const result = validateBackupFile(file);
    expect(result.ok).toBe(false);
  });

  it("rejects when a table value is not an array", () => {
    const file = makeFile({ tables: { profiles: { id: "x" } } as never });
    const result = validateBackupFile(file);
    expect(result.ok).toBe(false);
  });
});

describe("enforceBackupOwnership", () => {
  it("accepts a file whose user matches the session user", () => {
    expect(enforceBackupOwnership(makeFile(), USER_ID)).toBeNull();
  });

  it("rejects a file exported for a different user", () => {
    const error = enforceBackupOwnership(makeFile(), OTHER_USER_ID);
    expect(error).toMatch(/different account/i);
  });
});

describe("BACKUP_MAX_BYTES", () => {
  it("caps uploads at 10 MB", () => {
    expect(BACKUP_MAX_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe("friendlyImportError — RPC code → user copy", () => {
  it("maps known ownership codes to readable messages", () => {
    expect(friendlyImportError("backup_ownership_mismatch")).toMatch(/different account/i);
    expect(friendlyImportError("backup_not_authorized")).toMatch(/different account/i);
  });

  it("maps the unknown-table code even with the offending table appended", () => {
    expect(friendlyImportError("backup_unknown_table mystery_table")).toMatch(/unrecognized tables/i);
  });

  it("maps version and format codes", () => {
    expect(friendlyImportError("backup_unsupported_version")).toMatch(/newer app version/i);
    expect(friendlyImportError("backup_invalid_format")).toMatch(/doesn't look like/i);
  });

  it("falls back to a safe generic message for unknown errors", () => {
    expect(friendlyImportError("some_other_error")).toMatch(/nothing was changed/i);
  });
});