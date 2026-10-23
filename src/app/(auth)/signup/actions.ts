"use server";

import { signupSchema } from "@/lib/utils/validators";
import { createClient } from "@/lib/supabase/server";

export type SignupState = { error?: string; success?: boolean };

/**
 * Server-side signup — the real enforcement point for the new-password policy.
 *
 * The browser mirrors these checks in auth-forms.tsx for immediate feedback,
 * but anyone can call supabase.auth.signUp directly from the console, so the
 * Zod schema here is the gate that actually matters.
 *
 * Login deliberately does NOT use this action. Existing accounts with older,
 * simpler passwords must still authenticate, so login keeps calling
 * supabase.auth.signInWithPassword from the client with no policy check.
 *
 * On success this returns { success: true } rather than redirecting: Supabase
 * email confirmation means no session exists yet, so the UI shows
 * "Check your email" — redirecting would bounce straight back to /login.
 */
export async function signup(formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { email, password } = parsed.data;

  // emailRedirectTo is origin-aware on the client (localhost vs. prod) and is
  // passed through here; Supabase still validates it against the project's
  // redirect allowlist, so a tampered value is rejected server-to-server.
  const redirectTo = formData.get("redirectTo");
  const emailRedirectTo =
    typeof redirectTo === "string" && redirectTo ? redirectTo : undefined;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });
  if (error) {
    return { error: error.message };
  }
  return { success: true };
}
