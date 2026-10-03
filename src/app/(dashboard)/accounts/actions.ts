"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateUserFinancialCache } from "@/lib/cache/tags";
import { createAccount, updateAccount, archiveAccount } from "@/lib/services/account.service";
import { createTransfer, updateTransfer, deleteTransfer } from "@/lib/services/transfer.service";
import { accountSchema, accountTransferSchema } from "@/lib/utils/validators";

export async function addAccount(formData: {
  name: string;
  type: "bank" | "ewallet" | "cash" | "digital_bank" | "credit";
  initial_balance: number;
  color?: string;
  icon?: string;
}) {
  const parsed = accountSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await createAccount(supabase, user.id, parsed.data);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidateUserFinancialCache(user.id);
    return { success: true };
  } catch (err: any) {
    console.error("Failed to add account:", err);
    return { success: false, error: err?.message || "Unable to save account. Please try again." };
  }
}

export async function editAccount(
  accountId: string,
  formData: {
    name: string;
    type: "bank" | "ewallet" | "cash" | "digital_bank" | "credit";
    initial_balance: number;
    color?: string;
    icon?: string;
  }
) {
  const parsed = accountSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await updateAccount(supabase, user.id, accountId, parsed.data);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidateUserFinancialCache(user.id);
    return { success: true };
  } catch (err: any) {
    console.error("Failed to edit account:", err);
    return { success: false, error: err?.message || "Unable to update account. Please try again." };
  }
}

export async function toggleArchiveAccount(accountId: string, isArchived: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await archiveAccount(supabase, user.id, accountId, isArchived);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidateUserFinancialCache(user.id);
    return { success: true };
  } catch (err: any) {
    console.error("Failed to toggle archive status:", err);
    return { success: false, error: err?.message || "Unable to update archive status." };
  }
}

export async function addTransfer(formData: {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_fee?: number;
  date: string;
  notes?: string;
}) {
  const parsed = accountTransferSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await createTransfer(supabase, user.id, parsed.data);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    revalidateUserFinancialCache(user.id);
    return { success: true };
  } catch (err: any) {
    console.error("Failed to create transfer:", err);
    return { success: false, error: err?.message || "Unable to complete transfer. Please try again." };
  }
}

export async function editTransfer(
  transferId: string,
  formData: {
    from_account_id: string;
    to_account_id: string;
    amount: number;
    transfer_fee?: number;
    date: string;
    notes?: string;
  }
) {
  const parsed = accountTransferSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await updateTransfer(supabase, user.id, transferId, parsed.data);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    revalidateUserFinancialCache(user.id);
    return { success: true };
  } catch (err: any) {
    console.error("Failed to update transfer:", err);
    return { success: false, error: err?.message || "Unable to update transfer. Please try again." };
  }
}

const QR_BUCKET = "account-qrs";
const QR_MAX_BYTES = 5 * 1024 * 1024;

// Magic numbers, not MIME types: file.type is client-asserted and iOS Safari
// omits it entirely on some picks. PNG, JPEG, WebP only - the client pipeline
// normalizes everything to JPEG, so anything else arriving here bypassed it.
function sniffImageKind(bytes: Uint8Array): "png" | "jpeg" | "webp" | null {
  if (bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  return null;
}

/**
 * Receive-QR upload. Upsert order is the rollback story: upload the new bytes
 * first (upsert onto the fixed per-account key), write qr_image_path only once
 * the bytes land. A failed upload leaves the old QR - or no QR - exactly as it
 * was, never a column pointing at missing storage. Re-uploads overwrite the
 * same key, so there is no old object to delete.
 */
export async function uploadAccountQr(accountId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image file first." };
  }
  if (file.size > QR_MAX_BYTES) {
    return { error: "That image is too large (max 5 MB)." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: account, error: lookupError } = await supabase
    .from("accounts")
    .select("id,qr_image_path")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();
  // PGRST116 is "no row" (absent or foreign). Any other lookup failure is
  // infrastructure, and must not misreport as "not found" - that reading sent
  // a schema-cache stall down the wrong path once already.
  if (lookupError && lookupError.code !== "PGRST116") {
    console.error("Failed to verify account for QR upload:", lookupError);
    return { error: "Unable to verify the account. Please try again." };
  }
  if (!account) return { error: "Account not found." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Content kind comes from magic bytes, never the extension or the
  // client-asserted MIME - both lie (iOS omits the type; extensions rename).
  // Unidentified input is rejected, not guessed.
  const kind = sniffImageKind(bytes);
  if (!kind) {
    return { error: "That file is not a PNG, JPEG, or WebP image." };
  }
  const contentType =
    kind === "png" ? "image/png" : kind === "webp" ? "image/webp" : "image/jpeg";
  const ext = kind === "png" ? "png" : kind === "webp" ? "webp" : "jpg";

  const path = `${user.id}/${accountId}.${ext}`;
  // Previous key, if any: a kind change moves the object (png now, jpg
  // before), so the old key must go AFTER the new write lands. Same-key
  // re-uploads overwrite in place and skip this.
  const previousPath = account.qr_image_path || null;
  try {
    const { error: uploadError } = await supabase.storage
      .from(QR_BUCKET)
      .upload(path, bytes, { contentType, upsert: true });
    if (uploadError) throw uploadError;

    const { error: writeError } = await supabase
      .from("accounts")
      .update({ qr_image_path: path })
      .eq("id", accountId)
      .eq("user_id", user.id);
    if (writeError) throw writeError;

    if (previousPath && previousPath !== path) {
      await supabase.storage.from(QR_BUCKET).remove([previousPath]);
    }

    revalidatePath("/accounts");
    revalidateUserFinancialCache(user.id);
    return { success: true, path };
  } catch (err: any) {
    console.error("Failed to upload account QR:", err);
    return { success: false, error: err?.message || "Unable to save the QR code. Please try again." };
  }
}

/**
 * Receive-QR removal. Column first, object second: if the storage delete
 * fails the column is already null, leaving an invisible orphan rather than
 * a path pointing at nothing.
 */
export async function removeAccountQr(accountId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // The stored key, not a reconstructed one: keys now carry their true
  // extension, so rebuilding `{id}.jpg` would miss png-keyed objects.
  const { data: row } = await supabase
    .from("accounts")
    .select("qr_image_path")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();
  try {
    await supabase
      .from("accounts")
      .update({ qr_image_path: null })
      .eq("id", accountId)
      .eq("user_id", user.id);
    if (row?.qr_image_path) {
      await supabase.storage.from(QR_BUCKET).remove([row.qr_image_path]);
    }
    revalidatePath("/accounts");
    revalidateUserFinancialCache(user.id);
    return { success: true };
  } catch (err: any) {
    console.error("Failed to remove account QR:", err);
    return { success: false, error: err?.message || "Unable to remove the QR code. Please try again." };
  }
}

/**
 * Short-lived read URL for the QR display surfaces (modal thumbnail now,
 * fullscreen display in the next commit). Minted per open so expiry never
 * strands a stale screen; never a public URL.
 */
export async function getAccountQrUrl(accountId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: account, error: lookupError } = await supabase
    .from("accounts")
    .select("id,qr_image_path")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();
  if (lookupError || !account?.qr_image_path) return { error: "No QR code on file for this account." };

  const { data, error } = await supabase.storage
    .from(QR_BUCKET)
    .createSignedUrl(account.qr_image_path, 300);
  if (error || !data?.signedUrl) return { error: "Unable to load the QR code right now." };
  return { success: true, url: data.signedUrl };
}

export async function removeTransfer(transferId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  try {
    await deleteTransfer(supabase, user.id, transferId);
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    revalidateUserFinancialCache(user.id);
    return { success: true };
  } catch (err: any) {
    console.error("Failed to delete transfer:", err);
    return { success: false, error: err?.message || "Unable to delete transfer. Please try again." };
  }
}
