import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The mobile presentation of a record row, for the tables that a phone cannot
 * carry.
 *
 * Why this exists: a five-column table in an `overflow-x-auto` does not reflow
 * on a narrow screen, it degrades to a horizontal scroll INSIDE the card - and
 * the project's own note on the dashboard card says that "is worse than a tall
 * card". That reasoning was applied to the card and never to the full page. The
 * real damage is column ORDER: Amount was last, so the figure the user came for
 * sat off-screen behind four columns of metadata.
 *
 * So below `lg` a record is two lines - the thing and its figure on the primary
 * line, the metadata on the secondary - and above `lg` the table is unchanged.
 * One data source, two presentations, breakpoint-selected: the same shape as
 * ChartPair.
 *
 * `primary` is never allowed to be blank. A row whose title and category are
 * both empty would otherwise render as an amount beside nothing, which is a
 * worse lie than a vague label.
 */
export function RecordList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("divide-y divide-border/60 lg:hidden", className)}>{children}</div>;
}

export function RecordRow({
  icon,
  primary,
  secondary,
  badge,
  amount,
  amountTone = "default",
}: {
  icon?: ReactNode;
  /** The thing. Never blank - callers must resolve a fallback before passing. */
  primary: string;
  /** The metadata line: date, category/source, notes. */
  secondary?: ReactNode;
  badge?: ReactNode;
  amount: ReactNode;
  amountTone?: "default" | "income" | "expense";
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      {icon && <span className="mt-0.5 shrink-0 text-sm">{icon}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {/* truncate, and the amount is NOT inside this element: a long
              description must never push the figure off the row, which is the
              exact failure the five-column table had. */}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
            {primary}
          </span>
          {badge}
        </div>
        {secondary && (
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{secondary}</div>
        )}
      </div>
      <div
        className={cn(
          "shrink-0 whitespace-nowrap text-sm font-bold tabular-nums",
          amountTone === "income" && "text-sulpot-deep dark:text-sulpot-bright",
          amountTone === "expense" && "text-rose-600 dark:text-rose-400"
        )}
      >
        {amount}
      </div>
    </div>
  );
}

/**
 * The label a record falls back to when it has no title and no category.
 *
 * A blank primary line is not an edge case to shrug at - it renders as a figure
 * floating beside nothing, which reads as a broken row rather than a nameless
 * one. The type is the last honest thing available, so it is used last.
 */
export function recordPrimaryLabel(tx: {
  title?: string | null;
  categoryName?: string | null;
  type?: string;
}): string {
  const title = (tx.title ?? "").trim();
  if (title) return title;
  const category = (tx.categoryName ?? "").trim();
  if (category) return category;
  return tx.type === "income" ? "Income" : tx.type === "expense" ? "Expense" : "Record";
}
