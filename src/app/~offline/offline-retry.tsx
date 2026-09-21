"use client";

import { Button } from "@/components/ui/button";

export function OfflineRetry() {
  return (
    <Button variant="default" size="lg" onClick={() => window.location.reload()}>
      Try again
    </Button>
  );
}