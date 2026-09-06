"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { FintechCard, FintechCardContent, FintechCardHeader, FintechCardTitle } from "@/components/ui/fintech-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error caught by boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <FintechCard className="max-w-md w-full text-center p-6 space-y-4">
        <FintechCardHeader className="pb-2 flex flex-col items-center">
          <div className="h-12 w-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-2 shadow-xs">
            <AlertCircle className="h-6 w-6" />
          </div>
          <FintechCardTitle className="text-lg">Something went wrong</FintechCardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            An unexpected error occurred while rendering this view. Your data is safe.
          </p>
        </FintechCardHeader>
        <FintechCardContent className="space-y-4 pt-2">
          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={() => reset()}
              size="sm"
              className="rounded-xl gap-1.5 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Try Again
            </Button>
            <Link href="/dashboard">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-1.5 cursor-pointer"
              >
                <Home className="h-3.5 w-3.5" /> Return to Dashboard
              </Button>
            </Link>
          </div>
        </FintechCardContent>
      </FintechCard>
    </div>
  );
}
