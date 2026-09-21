"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Download, Upload, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FintechCard,
  FintechCardHeader,
  FintechCardTitle,
  FintechCardContent,
} from "@/components/ui/fintech-card";
import { toast } from "sonner";
import {
  exportBackup,
  importBackup,
  type ImportBackupState,
} from "@/app/(dashboard)/settings/backup-actions";

export function BackupCard() {
  const [exporting, setExporting] = useState(false);
  const [state, formAction, pending] = useActionState<
    ImportBackupState,
    FormData
  >(importBackup, {});

  async function handleExport() {
    setExporting(true);
    const res = await exportBackup();
    setExporting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    if (!res.data) {
      toast.error("Nothing to download.");
      return;
    }
    const blob = new Blob([res.data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `moneymap-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast.success("Backup exported");
  }

  return (
    <FintechCard className="max-w-xl">
      <FintechCardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <FintechCardTitle>Backup & Restore</FintechCardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          Export all your data to a file, or restore from a previous export
        </p>
      </FintechCardHeader>
      <FintechCardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div>
            <p className="text-xs font-bold text-foreground">Download backup</p>
            <p className="text-[11px] text-muted-foreground">
              All tables as JSON — ids preserved, lossless
            </p>
          </div>
          <Button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 px-4 cursor-pointer"
          >
            <Download className="mr-1.5 h-4 w-4" />
            {exporting ? "Exporting..." : "Export"}
          </Button>
        </div>

        <form action={formAction} className="space-y-3 rounded-xl border border-border p-3">
          <div>
            <p className="text-xs font-bold text-foreground">Restore backup</p>
            <p className="text-[11px] text-muted-foreground">
              Merges on top of current data — never deletes rows. Restores in a
              single transaction: all tables land or none do.
            </p>
          </div>

          {state.error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {state.error}
            </div>
          )}
          {state.success && (
            <div className="rounded-lg border border-emerald-600/20 bg-emerald-600/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
              Backup restored — {state.imported ?? 0} rows merged.
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="file"
              name="file"
              accept="application/json,.json"
              required
              disabled={pending}
              className="block w-full min-w-0 text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground dark:file:bg-slate-800 cursor-pointer"
            />
            <Button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9 px-4 cursor-pointer"
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {pending ? "Restoring..." : "Restore"}
            </Button>
          </div>
        </form>
      </FintechCardContent>
    </FintechCard>
  );
}