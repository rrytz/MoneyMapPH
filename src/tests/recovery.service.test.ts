/**
 * Unit tests for the account-recovery service (Option B).
 *
 * This is the quota-independent recovery path: email + recovery passphrase
 * (server-only env) + new password, enforced server-side via the GoTrue
 * admin API. These tests exercise the pure logic and the orchestration with
 * injected fakes — no real GoTrue/admin calls, no email.
 */
import { describe, it, expect } from "vitest";
import {
  recoverAccount,
  verifyRecoveryPassphrase,
  evaluateRecoveryLockout,
  RECOVERY_WINDOW_MS,
  RECOVERY_MAX_ATTEMPTS,
  type RecoveryDeps,
  type RecoveryResult,
} from "@/lib/services/recovery.service";
import { recoverySchema } from "@/lib/utils/validators";

const GOOD_EMAIL = "owner@example.com";
const GOOD_PASSPHRASE = "Zx9!kQ4#mP7@wV2$rT8&bN3^cJ5*Ld6";
const NEW_PASSWORD = "brand-new-password-42";

interface DepsWithCalls extends RecoveryDeps {
  calls: {
    listUser: number;
    updatePassword: number;
    recordFailure: number;
    clearFailures: number;
    getFailures: number;
  };
}

function makeDeps(overrides: Partial<RecoveryDeps> = {}): DepsWithCalls {
  const calls = {
    listUser: 0,
    updatePassword: 0,
    recordFailure: 0,
    clearFailures: 0,
    getFailures: 0,
  };
  return {
    configuredPassphrase: GOOD_PASSPHRASE,
    async listUserByEmail() {
      calls.listUser += 1;
      return { id: "user-123" };
    },
    async updateUserPassword() {
      calls.updatePassword += 1;
    },
    async getFailures() {
      calls.getFailures += 1;
      return [];
    },
    async recordFailure() {
      calls.recordFailure += 1;
    },
    async clearFailures() {
      calls.clearFailures += 1;
    },
    ...overrides,
    calls,
  };
}

function expectRecoveryError(result: RecoveryResult, pattern: RegExp) {
  if (result.ok) throw new Error("Expected recovery to fail");
  expect(result.error).toMatch(pattern);
}

describe("verifyRecoveryPassphrase — timing-safe comparison", () => {
  it("returns true when the passphrase matches exactly", () => {
    expect(verifyRecoveryPassphrase(GOOD_PASSPHRASE, GOOD_PASSPHRASE)).toBe(true);
  });

  it("returns false for a wrong passphrase", () => {
    expect(verifyRecoveryPassphrase("wrong-passphrase-value", GOOD_PASSPHRASE)).toBe(false);
  });

  it("returns false for an empty provided passphrase", () => {
    expect(verifyRecoveryPassphrase("", GOOD_PASSPHRASE)).toBe(false);
  });

  it("handles wildly different length inputs without throwing", () => {
    // Timings differ naturally; the implementation hashes before comparing.
    expect(verifyRecoveryPassphrase("short", GOOD_PASSPHRASE)).toBe(false);
  });
});

describe("evaluateRecoveryLockout — windowed attempt locking", () => {
  const now = new Date("2026-09-21T12:00:00Z");
  const minutesAgo = (m: number) =>
    new Date(now.getTime() - m * 60_000).toISOString();

  it("allows when there are no recorded attempts", () => {
    expect(evaluateRecoveryLockout([], now).allowed).toBe(true);
  });

  it("allows when attempts are below the threshold inside the window", () => {
    const result = evaluateRecoveryLockout(
      [minutesAgo(10), minutesAgo(9), minutesAgo(8), minutesAgo(7)],
      now
    );
    expect(result.allowed).toBe(true);
  });

  it("denies at the threshold inside the window and reports a retry delay", () => {
    const attempts = [2, 4, 6, 8, 10].map((i) => minutesAgo(i));
    const result = evaluateRecoveryLockout(attempts, now);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("ignores attempts outside the window", () => {
    const attempts = [16, 17, 18, 19, 20].map((i) => minutesAgo(i));
    expect(evaluateRecoveryLockout(attempts, now).allowed).toBe(true);
  });

  it("frees the lock once the oldest in-window attempt falls out of the window", () => {
    // 4 attempts 14 min ago (inside), 1 attempt 30 min ago (outside the window)
    const attempts = [30, 14, 14, 14, 14].map((i) => minutesAgo(i));
    expect(evaluateRecoveryLockout(attempts, now).allowed).toBe(true);
  });

  it("uses configurable window and threshold", () => {
    const secondsAgo = (s: number) => new Date(now.getTime() - s * 1000).toISOString();
    const attempts = [10, 20, 30].map((i) => secondsAgo(i));
    const result = evaluateRecoveryLockout(attempts, now, 60_000, 2);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    // Oldest attempt (30 s ago) leaves the 60 s window 30 s from now
    expect(result.retryAfterMs).toBe(30_000);
    expect(RECOVERY_WINDOW_MS).toBe(15 * 60_000);
    expect(RECOVERY_MAX_ATTEMPTS).toBe(5);
  });
});

describe("recoverAccount — orchestration", () => {
  it("resets the password on a valid email + passphrase, then clears failures", async () => {
    const deps = makeDeps();
    const result = await recoverAccount(
      { email: GOOD_EMAIL, passphrase: GOOD_PASSPHRASE, password: NEW_PASSWORD },
      deps,
      new Date("2026-09-21T12:00:00Z")
    );
    expect(result.ok).toBe(true);
    expect(deps.calls.listUser).toBe(1);
    expect(deps.calls.updatePassword).toBe(1);
    expect(deps.calls.clearFailures).toBe(1);
    expect(deps.calls.recordFailure).toBe(0);
  });

  it("normalizes the email case when looking up the user", async () => {
    let lookedUpWith: string | undefined;
    const deps = makeDeps({
      async listUserByEmail(email) {
        lookedUpWith = email;
        return { id: "user-123" };
      },
    });
    await recoverAccount(
      { email: "  Owner@Example.COM ", passphrase: GOOD_PASSPHRASE, password: NEW_PASSWORD },
      deps,
      new Date("2026-09-21T12:00:00Z")
    );
    expect(lookedUpWith).toBe("owner@example.com");
  });

  it("rejects a wrong passphrase, records the failure, and never touches the admin update", async () => {
    const deps = makeDeps();
    const result = await recoverAccount(
      { email: GOOD_EMAIL, passphrase: "wrong-passphrase-123", password: NEW_PASSWORD },
      deps,
      new Date("2026-09-21T12:00:00Z")
    );
    expectRecoveryError(result, /check your email and recovery passphrase/i);
    expect(deps.calls.recordFailure).toBe(1);
    expect(deps.calls.updatePassword).toBe(0);
    expect(deps.calls.clearFailures).toBe(0);
  });

  it("denies early when the identifier is locked out, without admin calls or extra failures", async () => {
    const lockedAt = new Date("2026-09-21T11:50:00Z");
    const now = new Date("2026-09-21T12:00:00Z");
    const deps = makeDeps({
      async getFailures() {
        return [1, 2, 3, 4, 5].map((i) =>
          new Date(lockedAt.getTime() + i * 60_000).toISOString()
        );
      },
    });
    const result = await recoverAccount(
      { email: GOOD_EMAIL, passphrase: GOOD_PASSPHRASE, password: NEW_PASSWORD },
      deps,
      now
    );
    expectRecoveryError(result, /too many failed attempts/i);
    expect(deps.calls.listUser).toBe(0);
    expect(deps.calls.updatePassword).toBe(0);
    expect(deps.calls.recordFailure).toBe(0);
  });

  it("records a failure when the email does not match any user", async () => {
    const deps = makeDeps({
      async listUserByEmail() {
        return null;
      },
    });
    const result = await recoverAccount(
      { email: "someone-else@example.com", passphrase: GOOD_PASSPHRASE, password: NEW_PASSWORD },
      deps,
      new Date("2026-09-21T12:00:00Z")
    );
    expectRecoveryError(result, /check your email and recovery passphrase/i);
    expect(deps.calls.recordFailure).toBe(1);
    expect(deps.calls.updatePassword).toBe(0);
  });

  it("records a failure when the admin password update throws", async () => {
    const deps = makeDeps({
      async updateUserPassword() {
        throw new Error("admin API down");
      },
    });
    const result = await recoverAccount(
      { email: GOOD_EMAIL, passphrase: GOOD_PASSPHRASE, password: NEW_PASSWORD },
      deps,
      new Date("2026-09-21T12:00:00Z")
    );
    expectRecoveryError(result, /check your email and recovery passphrase/i);
    expect(deps.calls.recordFailure).toBe(1);
  });

  it("refuses when recovery is not configured (no passphrase in env)", async () => {
    const deps = makeDeps({ configuredPassphrase: undefined });
    const result = await recoverAccount(
      { email: GOOD_EMAIL, passphrase: GOOD_PASSPHRASE, password: NEW_PASSWORD },
      deps,
      new Date("2026-09-21T12:00:00Z")
    );
    expectRecoveryError(result, /not configured/i);
    expect(deps.calls.getFailures).toBe(0);
    expect(deps.calls.listUser).toBe(0);
    expect(deps.calls.updatePassword).toBe(0);
    expect(deps.calls.recordFailure).toBe(0);
  });

  it("rejects invalid input without recording a failure (no attacker-triggered lockout)", async () => {
    const deps = makeDeps();
    const result = await recoverAccount(
      { email: "not-an-email", passphrase: GOOD_PASSPHRASE, password: "short" },
      deps,
      new Date("2026-09-21T12:00:00Z")
    );
    expect(result.ok).toBe(false);
    expect(deps.calls.recordFailure).toBe(0);
    expect(deps.calls.getFailures).toBe(0);
    expect(deps.calls.listUser).toBe(0);
  });
});

describe("recoverySchema — input validation", () => {
  it("accepts a valid recovery payload", () => {
    const parsed = recoverySchema.safeParse({
      email: GOOD_EMAIL,
      passphrase: GOOD_PASSPHRASE,
      password: NEW_PASSWORD,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const parsed = recoverySchema.safeParse({
      email: "nope",
      passphrase: GOOD_PASSPHRASE,
      password: NEW_PASSWORD,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty passphrase", () => {
    const parsed = recoverySchema.safeParse({
      email: GOOD_EMAIL,
      passphrase: "   ",
      password: NEW_PASSWORD,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a password shorter than 6 characters", () => {
    const parsed = recoverySchema.safeParse({
      email: GOOD_EMAIL,
      passphrase: GOOD_PASSPHRASE,
      password: "12345",
    });
    expect(parsed.success).toBe(false);
  });
});