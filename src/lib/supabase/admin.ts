/**
 * Server-only Supabase admin client.
 *
 * `import "server-only"` makes this module a build error if it ever reaches
 * a client bundle — the service-role key must never be shipped to the
 * browser. All functions here run under the service role, which bypasses RLS.
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";

const ATTEMPTS_TABLE = "auth_recovery_attempts";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function listUserByEmail(
  email: string
): Promise<{ id: string } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
  const match = data.users.find(
    (user) => user.email?.toLowerCase() === email
  );
  return match ? { id: match.id } : null;
}

export async function updateUserPassword(
  userId: string,
  password: string
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
  });
  if (error) throw error;
}

/**
 * Durable failure store for the recovery lockout. The table has RLS enabled
 * with no policies, so only the service role (used here) can touch it — the
 * anon key and signed-in users cannot read or write attempts.
 */

export async function getRecoveryFailures(
  identifier: string
): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(ATTEMPTS_TABLE)
    .select("created_at")
    .eq("identifier", identifier)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => row.created_at);
}

export async function recordRecoveryFailure(
  identifier: string
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from(ATTEMPTS_TABLE)
    .insert({ identifier });
  if (error) throw error;

  // Opportunistic pruning: keep only rows younger than 6 h per identifier.
  const cutoff = new Date(Date.now() - 6 * 3_600_000).toISOString();
  await admin
    .from(ATTEMPTS_TABLE)
    .delete()
    .eq("identifier", identifier)
    .lt("created_at", cutoff);
}

export async function clearRecoveryFailures(
  identifier: string
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from(ATTEMPTS_TABLE)
    .delete()
    .eq("identifier", identifier);
  if (error) throw error;
}