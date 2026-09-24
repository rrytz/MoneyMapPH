"use client";

import type { AccountTransfer } from "@/lib/types";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { ArrowRight, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TransferListProps {
  transfers: AccountTransfer[];
  onEdit: (transfer: AccountTransfer) => void;
  onDelete: (transferId: string) => void;
}

export function TransferList({ transfers, onEdit, onDelete }: TransferListProps) {
  if (transfers.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-8 text-center">
        <p className="text-sm text-muted-foreground">No internal transfers logged yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transfers.map((tr) => (
        <div
          key={tr.id}
          className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-slate-300 dark:hover:border-slate-700"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="rounded-lg bg-muted px-2.5 py-1">
                {tr.from_account?.name || "Unknown"}
                {tr.from_account?.is_archived && " (Archived)"}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="rounded-lg bg-muted px-2.5 py-1">
                {tr.to_account?.name || "Unknown"}
                {tr.to_account?.is_archived && " (Archived)"}
              </span>
            </div>
            {tr.notes && <span className="text-xs text-muted-foreground hidden sm:inline">• {tr.notes}</span>}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-semibold text-foreground text-sm">
                <CurrencyDisplay amount={tr.amount} />
              </div>
              {tr.transfer_fee > 0 && (
                <div className="text-[11px] text-amber-400 font-medium">
                  Fee: ₱{tr.transfer_fee.toFixed(2)}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => onEdit(tr)}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-rose-400"
                onClick={() => onDelete(tr.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
