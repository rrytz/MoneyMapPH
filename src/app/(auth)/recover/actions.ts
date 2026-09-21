"use server";

import { recoverAccount } from "@/lib/services/recovery.service";
import {
  listUserByEmail,
  updateUserPassword,
  getRecoveryFailures,
  recordRecoveryFailure,
  clearRecoveryFailures,
} from "@/lib/supabase/admin";

export type RecoverAccessState = { error?: string; success?: boolean };

/**
 * Server-only recovery entry point. The passphrase is read from
 * process.env.APP_RECOVERY_PASSPHRASE (server-only); nothing about it is ever
 * logged or returned to the client.
 */
export async function recoverAccess(
  _prevState: RecoverAccessState,
  formData: FormData
): Promise<RecoverAccessState> {
  const email = formData.get("email");
  const passphrase = formData.get("passphrase");
  const password = formData.get("password");

  if (
    typeof email !== "string" ||
    typeof passphrase !== "string" ||
    typeof password !== "string"
  ) {
    return { error: "Invalid submission." };
  }

  let result;
  try {
    result = await recoverAccount(
      { email, passphrase, password },
      {
        configuredPassphrase: process.env.APP_RECOVERY_PASSPHRASE,
        listUserByEmail,
        updateUserPassword,
        getFailures: getRecoveryFailures,
        recordFailure: recordRecoveryFailure,
        clearFailures: clearRecoveryFailures,
      }
    );
  } catch {
    // Never log the failure input — the recovery passphrase must not leak.
    return { error: "Something went wrong. Please try again in a moment." };
  }

  if (result.ok) return { success: true };
  return { error: result.error };
}