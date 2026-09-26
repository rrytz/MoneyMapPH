"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { recoverAccess, type RecoverAccessState } from "@/app/(auth)/recover/actions";

export function RecoveryForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<RecoverAccessState, FormData>(
    recoverAccess,
    {}
  );

  return (
    <div className="w-full">
      {state.success ? (
        <div className="text-center">
          <h1 className="type-page-title text-foreground">
            Password reset
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Your password was reset. Sign in with your new password to continue.
          </p>
          <Button
            type="button"
            className="mt-6 h-11 w-full rounded-xl text-[15px] font-semibold"
            onClick={() => router.push("/login")}
          >
            Back to sign in
          </Button>
        </div>
      ) : (
        <>
          <h1 className="type-page-title text-foreground">
            Recover access
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={pending}
                className="h-11 rounded-xl px-3.5"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="passphrase" className="text-[13px] text-muted-foreground">
                Recovery passphrase
              </Label>
              <Input
                id="passphrase"
                name="passphrase"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••••••••"
                required
                disabled={pending}
                className="h-11 rounded-xl px-3.5"
              />
              <p className="text-[11.5px] text-muted-foreground">
                The secret key configured for this deployment — keep it in your
                password manager.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[13px] text-muted-foreground">
                New password
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                required
                disabled={pending}
                minLength={6}
                className="h-11 rounded-xl px-3.5"
              />
            </div>

            <Button
              type="submit"
              className="h-11 w-full rounded-xl text-[15px] font-semibold"
              disabled={pending}
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
  );
}