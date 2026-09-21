"use server";

import { createClient } from "@/lib/supabase/server";
import {
  BACKUP_TABLES,
  BACKUP_MAX_BYTES,
  buildBackupDocument,
  validateBackupFile,
  enforceBackupOwnership,
  friendlyImportError,
} from "@/lib/services/backup.service";
import { revalidatePath } from "next/cache";

export type ExportBackupState = { data?: string; error?: string };
export type ImportBackupState = {
  success?: boolean;
  imported?: number;
  error?: string;
};

/**
 * Session-authenticated export. Never a public route: the action fails
 * closed without a session, the settings page redirects anonymous users,
 * and every query is RLS-scoped to the signed-in user.
 */
export async function exportBackup(): Promise<ExportBackupState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const tables: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) return { error: "Export failed. Please try again." };
    tables[table] = data ?? [];
  }

  const doc = buildBackupDocument(tables, user.id);
  return { data: JSON.stringify(doc) };
}

/**
 * Session-authenticated restore. The file is validated and ownership-checked
 * here, then handed to the moneymap_import_backup RPC, which runs the whole
 * restore in one transaction (all rows land or none do).
 */
export async function importBackup(
  _prevState: ImportBackupState,
  formData: FormData
): Promise<ImportBackupState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Please choose a backup file." };
  }
  if (file.size > BACKUP_MAX_BYTES) {
    return { error: "Backup file is too large (max 10 MB)." };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { error: "This doesn't look like a MoneyMap backup file." };
  }

  const validated = validateBackupFile(raw);
  if (!validated.ok) return { error: validated.error };

  const ownershipError = enforceBackupOwnership(validated.value, user.id);
  if (ownershipError) return { error: ownershipError };

  try {
    const { data: imported, error } = await supabase.rpc(
      "moneymap_import_backup",
      {
        payload: validated.value,
        p_owner: user.id,
      }
    );
    if (error) {
      return { error: friendlyImportError(error.message) };
    }
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    return { success: true, imported: typeof imported === "number" ? imported : 0 };
  } catch {
    return { error: "Import failed. Nothing was changed." };
  }
}