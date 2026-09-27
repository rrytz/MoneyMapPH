"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Two charts, side by side at lg and one at a time below it.
 *
 * Measured on a phone these are 375px and 278px, and they stack: 653px of a
 * ~667px fold spent on two visualisations, on the screen where a donut with a
 * five-item legend is not readable anyway. A toggle costs one tap and returns
 * 275px.
 *
 * One render, not two. The toggle is `lg:hidden` and both charts are visible at
 * lg regardless of state, so desktop is unchanged and there is no second
 * component tree to keep in step.
 */
export function ChartPair({
  trends,
  categories,
}: {
  trends: ReactNode;
  categories: ReactNode;
}) {
  const [view, setView] = useState<"trends" | "categories">("trends");

  const tab = (id: "trends" | "categories", label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      aria-selected={view === id}
      onClick={() => setView(id)}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
        view === id
          ? "bg-sulpot text-white"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Chart"
        className="mb-3 flex w-fit gap-1 rounded-full border bg-muted/40 p-1 lg:hidden"
      >
        {tab("trends", "Trends")}
        {tab("categories", "Categories")}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={cn(view === "trends" ? "block" : "hidden", "lg:block")}>{trends}</div>
        <div className={cn(view === "categories" ? "block" : "hidden", "lg:block")}>{categories}</div>
      </div>
    </div>
  );
}
