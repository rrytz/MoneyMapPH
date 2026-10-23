/**
 * Server-action enforcement tests for the new-password policy.
 *
 * The browser proves the client-side UX checks; these prove the SERVER side —
 * the reason signup does both. A password submitted through this action is
 * validated BEFORE supabase.auth.signUp is ever reached, so a caller who
 * bypasses the browser entirely is still rejected.
 *
 * Supabase's server client is mocked, so this proof is deterministic and
 * independent of the live project's signup-email rate limit (which blocks a
 * real end-to-end success capture).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { signUp, createClient } = vi.hoisted(() => {
  const signUp = vi.fn();
  const createClient = vi.fn(async () => ({ auth: { signUp } }));
  return { signUp, createClient };
});

vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { signup } from "@/app/(auth)/signup/actions";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  signUp.mockReset();
  createClient.mockClear();
  signUp.mockResolvedValue({ error: null });
});

describe("signup server action — policy enforced even when the browser is bypassed", () => {
  it("rejects a lowercase-only password without ever calling Supabase", async () => {
    const res = await signup(form({ email: "a@b.com", password: "passwordonly" }));
    expect(res.error).toMatch(/uppercase/);
    expect(createClient).not.toHaveBeenCalled(); // returned before Supabase
  });

  it("rejects a no-symbol password without calling Supabase", async () => {
    const res = await signup(form({ email: "a@b.com", password: "Password1" }));
    expect(res.error).toMatch(/symbol/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects a too-short password without calling Supabase", async () => {
    const res = await signup(form({ email: "a@b.com", password: "Ab!xy" }));
    expect(res.error).toMatch(/at least 8/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects an invalid email before Supabase", async () => {
    const res = await signup(form({ email: "not-an-email", password: "Password1!" }));
    expect(res.error).toMatch(/valid email/i);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("accepts a policy-compliant password, calls signUp, and returns success", async () => {
    const res = await signup(form({ email: "a@b.com", password: "Password1!" }));
    expect(res.success).toBe(true);
    expect(res.error).toBeUndefined();
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(signUp).toHaveBeenCalledTimes(1);
    const arg = signUp.mock.calls[0]?.[0];
    expect(arg?.email).toBe("a@b.com");
    expect(arg?.password).toBe("Password1!");
  });

  it("relays a Supabase signUp error back to the caller", async () => {
    signUp.mockResolvedValue({ error: { message: "email rate limit exceeded" } });
    const res = await signup(form({ email: "a@b.com", password: "Password1!" }));
    expect(res.error).toBe("email rate limit exceeded");
    expect(res.success).toBeUndefined();
  });
});
