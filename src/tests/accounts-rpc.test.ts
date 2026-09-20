import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Hardened SECURITY DEFINER RPC", () => {
  const migrationPath = join(process.cwd(), "supabase/migrations/20260921000000_create_multi_account_system.sql");
  const sql = readFileSync(migrationPath, "utf8");

  it("configures SECURITY DEFINER and search_path = ''", () => {
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = ''");
  });

  it("verifies user session authorization inside the function", () => {
    expect(sql).toContain("IF p_user_id IS NULL OR auth.uid() IS NULL OR p_user_id <> auth.uid() THEN");
    expect(sql).toContain("RAISE EXCEPTION 'Unauthorized database function access';");
  });

  it("revokes execution from PUBLIC and grants to authenticated", () => {
    expect(sql).toContain("REVOKE EXECUTE ON FUNCTION public.get_account_aggregates(UUID, DATE) FROM PUBLIC;");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.get_account_aggregates(UUID, DATE) TO authenticated;");
  });

  it("filters transaction calculations by Asia/Manila date cutoff", () => {
    expect(sql).toContain("e.date <= p_today");
    expect(sql).toContain("x.date <= p_today");
    expect(sql).toContain("t.date <= p_today");
  });
});
