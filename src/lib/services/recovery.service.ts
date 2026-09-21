/**
 * Account-recovery service (quota-independent).
 *
 * Recovery uses the GoTrue admin API with a server-only service-role key, so
 * it never depends on GoTrue email delivery (which is quota-throttled on this
 * project). Flow: validate input → lockout check → timing-safe passphrase
 * compare → admin password reset → clear failures.
 *
 * All external dependencies (user lookup, password update, failure store) are
 * injected so this module is purely testable without touching real GoTrue.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { recoverySchema } from "@/lib/utils/validators";

export const RECOVERY_WINDOW_MS = 15 * 60_000;
export const RECOVERY_MAX_ATTEMPTS = 5;

const GENERIC_FAILURE =
  "Recovery failed. Check your email and recovery passphrase, then try again.";
const LOCKED_MESSAGE = "Too many failed attempts. Try again in a few minutes.";
const UNCONFIGURED_MESSAGE = "Recovery is not configured on this deployment.";

export type RecoveryResult = { ok: true } | { ok: false; error: string };

export interface RecoveryDeps {
  /** The server-only recovery passphrase (APP_RECOVERY_PASSPHRASE), or undefined when unconfigured. */
  configuredPassphrase: string | undefined;
  listUserByEmail(email: string): Promise<{ id: string } | null>;
  updateUserPassword(userId: string, password: string): Promise<void>;
  /** ISO timestamps of previous failures for an identifier, newest first. */
  getFailures(identifier: string): Promise<string[]>;
  recordFailure(identifier: string): Promise<void>;
  clearFailures(identifier: string): Promise<void>;
}

/**
 * Constant-time passphrase comparison. Both inputs are sha256-hashed first so
 * digest length is fixed regardless of input length.
 */
export function verifyRecoveryPassphrase(
  provided: string | undefined,
  expected: string
): boolean {
  if (!provided) return false;
  const providedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

/**
 * Windowed lockout: counts failures strictly inside the window and denies once
 * the threshold is reached. `retryAfterMs` is how long until the oldest
 * in-window failure expires.
 */
export function evaluateRecoveryLockout(
  attempts: string[],
  now: Date,
  windowMs: number = RECOVERY_WINDOW_MS,
  maxAttempts: number = RECOVERY_MAX_ATTEMPTS
): { allowed: boolean; retryAfterMs: number } {
  const windowStart = now.getTime() - windowMs;
  const recent = attempts
    .map((ts) => new Date(ts).getTime())
    .filter((t) => !Number.isNaN(t) && t > windowStart)
    .sort((a, b) => b - a);

  if (recent.length < maxAttempts) {
    return { allowed: true, retryAfterMs: 0 };
  }

  const oldestInWindow = recent[recent.length - 1];
  const retryAfterMs = Math.max(0, oldestInWindow + windowMs - now.getTime());
  return { allowed: false, retryAfterMs };
}

export async function recoverAccount(
  input: { email: string; passphrase: string; password: string },
  deps: RecoveryDeps,
  now: Date = new Date()
): Promise<RecoveryResult> {
  const parsed = recoverySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const identifier = parsed.data.email.toLowerCase();

  if (!deps.configuredPassphrase) {
    return { ok: false, error: UNCONFIGURED_MESSAGE };
  }

  const failures = await deps.getFailures(identifier);
  const lockout = evaluateRecoveryLockout(failures, now);
  if (!lockout.allowed) {
    return { ok: false, error: LOCKED_MESSAGE };
  }

  if (!verifyRecoveryPassphrase(parsed.data.passphrase, deps.configuredPassphrase)) {
    await deps.recordFailure(identifier);
    return { ok: false, error: GENERIC_FAILURE };
  }

  const user = await deps.listUserByEmail(identifier);
  if (!user) {
    await deps.recordFailure(identifier);
    return { ok: false, error: GENERIC_FAILURE };
  }

  try {
    await deps.updateUserPassword(user.id, parsed.data.password);
  } catch {
    await deps.recordFailure(identifier);
    return { ok: false, error: GENERIC_FAILURE };
  }

  await deps.clearFailures(identifier);
  return { ok: true };
}