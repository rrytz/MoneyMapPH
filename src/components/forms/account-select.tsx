"use client";

import type { Account } from "@/lib/types";

/**
 * The option text for an account: the name, plus the type only when the type
 * says something the name does not already say.
 *
 * It used to concatenate unconditionally, so an account named "Cash" of type
 * "cash" rendered "Cash (Cash)" - the type repeated verbatim in parentheses,
 * which reads as a mistake rather than as information. The same held for
 * "Maya" / "ewallet" and "BPI" / "bank".
 *
 * `·` rather than parentheses so a multi-word type reads as a label
 * ("BPI Savings · Digital Bank") instead of colliding with the name's own
 * bracket-free typography.
 */
function accountOptionLabel(name: string, type: string): string {
  const typeLabel = type
    .replace(/_/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const nameKey = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const typeKey = typeLabel.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!typeKey || nameKey.includes(typeKey)) return name;
  return `${name} · ${typeLabel}`;
}

interface AccountSelectProps {
  accounts: Account[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
  /**
   * Presentation only. `false` is the form field, exactly as it was.
   *
   * This component is a LABEL, a CONTROL and a HELPER PARAGRAPH, and reusing it
   * verbatim inside a ledger row repeated it fifteen times: a 173px row where
   * the measurement had predicted 46 + 10, with the title truncated to `Mis…`
   * because the `w-full` select forced the row to stack. The earlier measurement
   * was of an injected `<select>`, not of this component - the same mistake as
   * measuring a pure hex and calling it a rendered wash.
   *
   * So `compact` removes only the vertical chrome: the label becomes
   * screen-reader-only rather than disappearing, because fifteen visible copies
   * of "Account / Wallet (Optional)" is noise and fifteen copies of nothing is
   * an unlabelled control. The helper paragraph is dropped for the same reason -
   * it is documentation, and documentation does not belong on a ledger row.
   *
   * What does NOT change: the same `<select>`, the same options, the same
   * `None / Unassigned` value, the same optionality, the same validation. The
   * account a row points at is identical in both modes.
   */
  compact?: boolean;
}

export function AccountSelect({
  accounts,
  value,
  onChange,
  disabled = false,
  label = "Account / Wallet (Optional)",
  compact = false,
}: AccountSelectProps) {
  const activeAccounts = accounts.filter((a) => !a.is_archived);

  return (
    <div className={compact ? "" : "space-y-1.5"}>
      <label
        htmlFor={compact ? `account-select-compact-${value || "none"}` : undefined}
        className={
          compact
            ? "sr-only"
            : "block text-sm font-medium text-foreground"
        }
      >
        {label}
      </label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={compact ? label : undefined}
        className={
          compact
            ? // h-8 and the same border/radius as the form control, so the row
              // lands near the 46px the other ledgers use. NOT a fixed width:
              // the width is whatever the row gives it, because a width guessed
              // from a probe is how the last attempt measured the wrong object.
              "h-8 max-w-[190px] rounded-lg border border-input bg-background px-2 text-xs text-foreground transition focus:border-sulpot focus:outline-none focus:ring-1 focus:ring-sulpot disabled:opacity-50"
            : "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition focus:border-sulpot focus:outline-none focus:ring-1 focus:ring-sulpot disabled:opacity-50"
        }
      >
        <option value="">None / Unassigned</option>
        {activeAccounts.map((acc) => (
          <option key={acc.id} value={acc.id}>
            {accountOptionLabel(acc.name, acc.type)}
          </option>
        ))}
      </select>
      {!compact && (
        <p className="text-xs text-muted-foreground">
          Optional: Tag which account or wallet this money belongs to.
        </p>
      )}
    </div>
  );
}
