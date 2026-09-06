import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export function getSafeRedirectPath(nextParam: string | null): string {
  if (!nextParam) return "/dashboard";
  if (
    nextParam.startsWith("/") &&
    !nextParam.startsWith("//") &&
    !nextParam.includes(":") &&
    /^\/[a-zA-Z0-9\-_/]*$/.test(nextParam.split("?")[0])
  ) {
    return nextParam;
  }
  return "/dashboard";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next");
  const safeNext = getSafeRedirectPath(nextRaw);

  const oauthError = searchParams.get("error");
  const oauthErrorDescription = searchParams.get("error_description");

  if (oauthError) {
    console.error("Auth callback received OAuth error:", oauthError, oauthErrorDescription);
    const safeErrorParam = encodeURIComponent(oauthErrorDescription || oauthError);
    return NextResponse.redirect(`${origin}/login?error=${safeErrorParam}`);
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${safeNext}`);
      }
      console.error("Auth callback exchangeCodeForSession failed:", error.message);
    } catch (err) {
      console.error("Unexpected error during exchangeCodeForSession:", err);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
