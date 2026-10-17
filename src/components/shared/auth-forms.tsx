"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { createClient, getAuthRedirectTo } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/shared/logo";
import { Loader2, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";

/* Mode is derived from the route: /login renders sign-in, /signup renders the
   create-account form. Switching happens through the footer links (a soft
   navigation), so there is no tab pill and no client-side mode state — the
   entrance animation simply replays on mount. */
export function AuthForm() {
  const pathname = usePathname();
  const isSignin = pathname !== "/signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const anim = (delay: number) => ({ animationDelay: `${delay}s` });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isSignin && password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!isSignin && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    if (isSignin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      window.location.href = "/dashboard";
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getAuthRedirectTo() },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getAuthRedirectTo() },
    });
    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-border/50 bg-card/40 p-8 backdrop-blur-xl">
        {/* Mark */}
        <div className="flex justify-center auth-animate-rise">
          <Logo size="md" />
        </div>

        {success ? (
          <div className="mt-7 text-center auth-animate-rise">
            <h1 className="type-page-title text-3xl text-white">Check your email</h1>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-white/60">
              We sent a confirmation link to{" "}
              <strong className="text-white">{email}</strong>. Click it to activate
              your account.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block text-sm font-semibold text-sulpot-bright hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1
              className="type-page-title mt-7 text-center text-3xl text-white auth-animate-rise"
              style={anim(0.05)}
            >
              {isSignin ? "Welcome back" : "Create your account"}
            </h1>

            <form onSubmit={handleSubmit} className="mt-7 space-y-3.5">
              {error && (
                <div
                  role="alert"
                  className="auth-animate-fade rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
                >
                  {error}
                </div>
              )}

              {/* Email */}
              <div className="relative auth-animate-rise" style={anim(0.09)}>
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 text-white placeholder:text-white/40 focus-visible:border-sulpot-bright/60 focus-visible:ring-sulpot-bright/20"
                />
              </div>

              {/* Password */}
              <div className="relative auth-animate-rise" style={anim(0.13)}>
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignin ? "current-password" : "new-password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 pr-10 text-white placeholder:text-white/40 focus-visible:border-sulpot-bright/60 focus-visible:ring-sulpot-bright/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white/70"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Confirm password (create-account only) */}
              {!isSignin && (
                <div className="relative auth-animate-rise" style={anim(0.17)}>
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                    className="h-12 rounded-xl border-white/10 bg-white/5 pl-10 pr-10 text-white placeholder:text-white/40 focus-visible:border-sulpot-bright/60 focus-visible:ring-sulpot-bright/20"
                  />
                </div>
              )}

              {/* Forgot password (sign-in only) */}
              {isSignin && (
                <div
                  className="auth-animate-rise pt-0.5 text-right"
                  style={anim(0.2)}
                >
                  <Link
                    href="/recover"
                    className="text-sm text-white/50 transition-colors hover:text-white/80"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              {/* Disabled on required-EMPTY, never on invalid: a short or
                  mismatched password stays submittable so the error alert
                  teaches instead of a gray button hiding it. */}
              <Button
                type="submit"
                className="auth-animate-rise h-12 w-full rounded-xl bg-gradient-to-r from-sulpot-deep to-sulpot text-[15px] font-semibold text-white shadow-lg shadow-sulpot/20 hover:from-sulpot-deep hover:to-sulpot-bright"
                style={anim(0.24)}
                disabled={loading || !email.trim() || !password || (!isSignin && !confirmPassword)}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSignin ? "Sign in" : "Create account"}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>

            {/* Divider */}
            <div
              className="my-6 flex items-center gap-3 text-xs text-white/40 auth-animate-rise"
              style={anim(0.28)}
              aria-hidden
            >
              <span className="h-px flex-1 bg-white/10" />
              or continue with
              <span className="h-px flex-1 bg-white/10" />
            </div>

            {/* Google */}
            <Button
              variant="outline"
              className="auth-animate-rise h-12 w-full rounded-xl border-white/10 bg-white/5 text-sm font-semibold text-white hover:bg-white/10 hover:text-white"
              style={anim(0.32)}
              onClick={handleGoogle}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <svg className="mr-2 h-[18px] w-[18px]" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              Continue with Google
            </Button>

            {/* Mode switch */}
            <p
              className="mt-6 text-center text-sm text-white/50 auth-animate-rise"
              style={anim(0.36)}
            >
              {isSignin ? (
                <>
                  Don&apos;t have an account?{" "}
                  <Link
                    href="/signup"
                    className="font-semibold text-sulpot-bright hover:underline"
                  >
                    Create one
                  </Link>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-sulpot-bright hover:underline"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </p>
          </>
        )}
      </div>

      {/* Security note */}
      <p
        className="mt-8 flex items-center justify-center gap-1.5 text-xs text-white/40 auth-animate-rise"
        style={anim(0.4)}
      >
        <Lock className="h-3 w-3" />
        Your information is secure and encrypted
      </p>
    </div>
  );
}
