"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error caught by root boundary:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 text-center space-y-4 shadow-lg">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. Please try reloading or check back shortly.
        </p>
        <div className="pt-2">
          <Button
            onClick={() => reset()}
            className="rounded-xl px-5 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Reload Application
          </Button>
        </div>
      </div>
    </div>
  );
}
