/**
 * Backup & restore service — pure logic around the transactional import RPC.
 *
 * The heavy lifting (transactional, FK-safe, upsert-merge restore) lives in
 * the plpgsql function moneymap_import_backup (see
 * supabase/migrations/20260921000002_backup_import.sql) and is verified by
 * the live round-trip test. This module owns the file-format contract, the
 * table manifest, and ownership enforcement shared by export and import.
 */
import { z } from "zod";

export const BACKUP_FORMAT = "moneymap-backup";
export const BACKUP_SCHEMA_VERSION = 1;
export const BACKUP_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Import order: every parent table precedes the children that reference it,
 * so FK constraints never fail mid-restore.
 */
export const BACKUP_TABLES = [
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
] as const;

const BACKUP_TABLE_SET = new Set<string>(BACKUP_TABLES);

/**
 * Tables whose ownership is carried by user_id directly (or, for profiles,
 * by id = the owner). The remaining child tables are enforced transitively
 * through their parent FK inside the import RPC.
 */
export const OWNER_SCOPED_TABLES = new Set<string>([
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
  "income_entries",
  "expenses",
  "account_transfers",
  "monthly_snapshots",
]);

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  user: { id: string };
  tables: Record<string, unknown[]>;
};

const backupMetaSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: z.string(),
  user: z.object({ id: z.string().min(1) }),
});

export function isOwnerScopedTable(table: string): boolean {
  return OWNER_SCOPED_TABLES.has(table);
}

export function buildBackupDocument(
  tables: Record<string, unknown[]>,
  userId: string,
  now: Date = new Date()
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    user: { id: userId },
    tables,
  };
}

export type BackupValidation =
  | { ok: true; value: BackupFile }
  | { ok: false; error: string };

export function validateBackupFile(raw: unknown): BackupValidation {
  const parsed = backupMetaSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "This doesn't look like a MoneyMap backup file.",
    };
  }

  const tables = (raw as { tables?: unknown }).tables;
  if (typeof tables !== "object" || tables === null || Array.isArray(tables)) {
    return { ok: false, error: "Backup file is missing the tables map." };
  }

  const tableMap = tables as Record<string, unknown>;
  for (const [key, value] of Object.entries(tableMap)) {
    if (!BACKUP_TABLE_SET.has(key)) {
      return { ok: false, error: `Unknown table "${key}" in backup file.` };
    }
    if (!Array.isArray(value)) {
      return { ok: false, error: `Table "${key}" must be an array of rows.` };
    }
  }

  for (const table of BACKUP_TABLES) {
    if (!(table in tableMap)) {
      return { ok: false, error: `Backup file is missing table "${table}".` };
    }
  }

  return { ok: true, value: raw as BackupFile };
}

/** Returns an error message when the file belongs to a different account, else null. */
export function enforceBackupOwnership(
  file: BackupFile,
  sessionUserId: string
): string | null {
  if (file.user.id !== sessionUserId) {
    return "This backup belongs to a different account and cannot be imported here.";
  }
  return null;
}

const IMPORT_ERROR_MESSAGES: Record<string, string> = {
  backup_not_authorized: "This backup belongs to a different account.",
  backup_owner_required: "Sign-in is required to restore a backup.",
  backup_invalid_format: "This doesn't look like a MoneyMap backup file.",
  backup_unsupported_version:
    "This backup was made by a newer app version. Update the app and try again.",
  backup_missing_tables: "Backup file is missing its tables.",
  backup_unknown_table: "Backup file contains unrecognized tables.",
  backup_ownership_mismatch: "Backup contains data for a different account.",
};

/** Maps plpgsql RAISE codes to readable copy; unknown errors get a safe generic message. */
export function friendlyImportError(raw: string): string {
  for (const [code, message] of Object.entries(IMPORT_ERROR_MESSAGES)) {
    // Some codes carry a suffix (e.g. "backup_unknown_table mystery_table").
    if (raw === code || raw.startsWith(`${code} `)) return message;
  }
  return "Import failed. Nothing was changed.";
}