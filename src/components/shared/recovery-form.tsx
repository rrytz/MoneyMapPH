"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/shared/logo";
import { Loader2, Lock } from "lucide-react";
import { recoverAccess, type RecoverAccessState } from "@/app/(auth)/recover/actions";

export function RecoveryForm() {
  const [state, formAction, pending] = useActionState<RecoverAccessState, FormData>(
    recoverAccess,
    {}
  );
  // Mirrors for the submit-button state only; the action still reads FormData.
  const [email, setEmail] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-border/50 bg-card/40 p-8 backdrop-blur-xl">
        {/* Mark — matches the login/signup card's centered mark for sibling parity */}
        <div className="flex justify-center">
          <Logo size="md" />
        </div>

        {state.success ? (
          <div className="mt-7 text-center">
            <h1 className="type-page-title text-3xl text-foreground">
              Password reset
            </h1>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Your password was reset. Sign in with your new password to continue.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block text-sm font-semibold text-sulpot-deep hover:underline dark:text-sulpot-bright"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="type-page-title mt-7 text-center text-3xl text-foreground">
              Recover access
            </h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Reset your password without email — you&apos;ll only need your
              recovery passphrase.
            </p>

            <form action={formAction} className="mt-7 space-y-4">
              {state.error && (
                <div
                  role="alert"
                  className="auth-animate-fade rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {state.error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-[13px] text-muted-foreground">
                  Email <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={pending}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl px-3.5"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="passphrase" className="text-[13px] text-muted-foreground">
                  Recovery passphrase <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="passphrase"
                  name="passphrase"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••••••••••"
                  required
                  disabled={pending}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="h-11 rounded-xl px-3.5"
                />
                <p className="text-[11.5px] text-muted-foreground">
                  The secret key configured for this deployment — keep it in your
                  password manager.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[13px] text-muted-foreground">
                  New password <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  required
                  disabled={pending}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  className="h-11 rounded-xl px-3.5"
                />
                <p className="text-[11.5px] text-muted-foreground">
                  Requires 8+ characters, 1 uppercase letter, and 1 symbol.
                </p>
              </div>

              {/* Disabled on required-EMPTY, never on invalid: a short password
                  stays submittable so the schema message teaches the minimum. */}
              <Button
                type="submit"
                className="h-11 w-full rounded-xl bg-gradient-to-r from-sulpot-deep to-sulpot text-[15px] font-semibold text-white shadow-lg shadow-sulpot/20 hover:from-sulpot-deep hover:to-sulpot-bright"
                disabled={pending || !email.trim() || !passphrase || !password}
              >
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset password
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Remembered it?{" "}
              <Link
                href="/login"
                className="font-semibold text-sulpot-deep hover:underline dark:text-sulpot-bright"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>

      <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-white/40">
        <Lock className="h-3 w-3" />
        Your information is secure and encrypted
      </p>
    </div>
  );
}
