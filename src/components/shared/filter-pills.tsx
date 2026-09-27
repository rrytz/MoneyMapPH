"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export interface PillOption {
  value: string;
  label: string;
}

/**
 * A row of filter pills, replacing a single-value Select.
 *
 * SEMANTICS: radio, not toggle button.
 *
 * These options are mutually exclusive with exactly one selected, which is a
 * radio group - the same shape as the <select> this replaces, so the
 * accessibility contract does not change with the visuals. `aria-pressed` is
 * for toggle buttons (many independently on/off things); putting it on a
 * single-select control misreports the model to a screen reader.
 *
 * That means roving tabindex: the checked pill is the only one in the tab
 * order, and arrow keys move focus AND selection, which is what every platform
 * radio group does. Tab therefore leaves the group rather than walking it.
 *
 * WHY NO LEADING LABEL
 *
 * At 320px the filter card has about 256px of content width. Three pills plus a
 * "TYPE" label land within a couple of pixels of that, so the label had to go:
 * the pills sit directly above a search field and a category filter on a
 * transactions ledger, where "All / Income / Expenses" is not ambiguous. The
 * group still carries an aria-label, so assistive technology is told what the
 * control filters even though the visual label is gone.
 */
export function FilterPills({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: PillOption[];
  value: string;
  onChange: (value: string) => void;
  /** Announced for the group. Required: there is no visible label. */
  label: string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );

  function focusAt(index: number) {
    const next = (index + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].value);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(options.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex items-center gap-1.5 overflow-x-auto", className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            // Roving tabindex: only the selected pill is tabbable, so Tab
            // moves past the group and arrows move within it.
            tabIndex={index === selectedIndex ? 0 : -1}
            ref={(el) => {
              refs.current[index] = el;
            }}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cn(
              "h-9 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sulpot focus-visible:ring-offset-1 focus-visible:ring-offset-card",
              selected
                ? "border-sulpot bg-sulpot text-white"
                : "border-border bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
