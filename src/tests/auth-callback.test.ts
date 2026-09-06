/**
 * Unit tests for getSafeRedirectPath in auth/callback/route.ts
 *
 * These tests verify the open-redirect prevention logic that validates
 * the `next` query parameter before using it in a redirect.
 */

import { describe, it, expect } from "vitest";
import { getSafeRedirectPath } from "@/app/(auth)/auth/callback/route";

describe("getSafeRedirectPath — open redirect prevention", () => {
  it("returns /dashboard when next is null", () => {
    expect(getSafeRedirectPath(null)).toBe("/dashboard");
  });

  it("returns /dashboard when next is empty string", () => {
    expect(getSafeRedirectPath("")).toBe("/dashboard");
  });

  it("accepts valid relative paths starting with single /", () => {
    expect(getSafeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(getSafeRedirectPath("/income")).toBe("/income");
    expect(getSafeRedirectPath("/savings/goals")).toBe("/savings/goals");
  });

  it("rejects double-slash protocol-relative URLs (//evil.com)", () => {
    expect(getSafeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(getSafeRedirectPath("//evil.com/steal")).toBe("/dashboard");
  });

  it("rejects absolute URLs with http scheme", () => {
    expect(getSafeRedirectPath("http://evil.com")).toBe("/dashboard");
  });

  it("rejects absolute URLs with https scheme", () => {
    expect(getSafeRedirectPath("https://evil.com")).toBe("/dashboard");
  });

  it("rejects data: URIs", () => {
    expect(getSafeRedirectPath("data:text/html,<script>alert(1)</script>")).toBe("/dashboard");
  });

  it("rejects javascript: URIs", () => {
    expect(getSafeRedirectPath("javascript:alert(1)")).toBe("/dashboard");
  });

  it("rejects paths containing colons (e.g. encoded schemes)", () => {
    expect(getSafeRedirectPath("/path:with:colons")).toBe("/dashboard");
  });

  it("rejects paths containing special characters outside allowed set", () => {
    expect(getSafeRedirectPath("/path with spaces")).toBe("/dashboard");
    expect(getSafeRedirectPath("/path<script>")).toBe("/dashboard");
  });

  it("accepts paths with query strings", () => {
    // The regex only validates the path part (before ?)
    const result = getSafeRedirectPath("/dashboard?tab=overview");
    expect(result).toBe("/dashboard?tab=overview");
  });

  it("accepts deeply nested valid paths", () => {
    expect(getSafeRedirectPath("/reports/monthly/2026-09")).toBe("/reports/monthly/2026-09");
  });
});
