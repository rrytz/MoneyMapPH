import * as React from "react";
import { cn } from "@/lib/utils";

type FintechCardVariant = "surface" | "featured" | "inset";

const variantClasses: Record<FintechCardVariant, string> = {
  // Workhorse: flat hairline card for structure (KPI cards, account cards,
  // settings tiles, list panels). Never raises a shadow at rest.
  // S5a radius ladder: cards live at 2xl (24px); the hero alone at 3xl (32px).
  surface: "rounded-2xl border border-border bg-card text-card-foreground p-6",
  // The one resting raised card — the Financial Health hero only.
  featured:
    "rounded-3xl border border-border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow duration-200 p-6",
  // Flat tonal layer boxed INSIDE a card: no border, no shadow of its own.
  inset: "rounded-lg bg-muted/30 border-transparent p-4",
};

export function FintechCard({
  variant = "surface",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: FintechCardVariant }) {
  return (
    <div
      className={cn(variantClasses[variant], className)}
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
