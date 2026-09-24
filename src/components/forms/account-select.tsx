"use client";

import type { Account } from "@/lib/types";

interface AccountSelectProps {
  accounts: Account[];
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

export function AccountSelect({
  accounts,
  value,
  onChange,
  disabled = false,
  label = "Account / Wallet (Optional)",
}: AccountSelectProps) {
  const activeAccounts = accounts.filter((a) => !a.is_archived);

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
      >
        <option value="">None / Unassigned</option>
        {activeAccounts.map((acc) => (
          <option key={acc.id} value={acc.id}>
            {acc.name} ({acc.type.replace("_", " ")})
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        Optional: Tag which account or wallet this money belongs to.
      </p>
    </div>
  );
}
