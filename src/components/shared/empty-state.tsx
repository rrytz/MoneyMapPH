import { ReactNode, ComponentType } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: ReactNode | ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}

export function EmptyState({ icon: IconOrNode, title, description, actionLabel, onAction, actionHref }: EmptyStateProps) {
  const isComponent = typeof IconOrNode === "function" || (typeof IconOrNode === "object" && IconOrNode !== null && !("props" in IconOrNode));
  const IconComponent = isComponent ? (IconOrNode as ComponentType<{ className?: string }>) : null;

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/20 rounded-2xl border border-dashed border-border my-2">
      <div className="p-3 bg-primary/10 text-primary rounded-2xl mb-3">
        {IconComponent ? <IconComponent className="h-6 w-6" /> : (IconOrNode as ReactNode)}
      </div>
      <h4 className="text-base font-semibold text-foreground mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground max-w-xs mb-4">{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <Button size="sm" className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs px-4 cursor-pointer">
            {actionLabel}
          </Button>
        </Link>
      )}
      {actionLabel && !actionHref && (
        <Button
          size="sm"
          className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs px-4 cursor-pointer"
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
