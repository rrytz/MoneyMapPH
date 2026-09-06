import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function getAuthRedirectTo(path = "/auth/callback") {
  const isLocalhost =
    typeof window !== "undefined" && window.location.hostname === "localhost";
  const origin = isLocalhost
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL ??
      (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin}${path}`;
}
