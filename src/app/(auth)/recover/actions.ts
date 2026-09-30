"use server";

import { recoverAccount } from "@/lib/services/recovery.service";
import { recoverySchema } from "@/lib/utils/validators";
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
  // recoverySchema existed in validators.ts and was imported nowhere - the gate
  // was three typeof checks. Same shape as every other validated action:
  // safeParse first, schema message on failure, typed data after.
  const parsed = recoverySchema.safeParse({
    email: formData.get("email"),
    passphrase: formData.get("passphrase"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { email, passphrase, password } = parsed.data;

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