import * as React from "react";
import { cn } from "@/lib/utils";

export function FintechCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow duration-200 p-5",
        className
      )}
      {...props}
    />
  );
}

export function FintechCardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 pb-3", className)} {...props} />;
}

export function FintechCardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-semibold text-base tracking-tight text-foreground", className)} {...props} />;
}

export function FintechCardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pt-0", className)} {...props} />;
}
