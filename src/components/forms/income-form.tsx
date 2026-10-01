"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addIncome, editIncome } from "@/app/(dashboard)/income/actions";
import type { IncomeEntry, IncomeSource, Account } from "@/lib/types";
import { toISODateString } from "@/lib/utils/date";
import { AccountSelect } from "@/components/forms/account-select";

interface IncomeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: IncomeSource[];
  accounts?: Account[];
  editEntry?: IncomeEntry | null;
  onAdd?: (data: { amount: number; source_id: string; date: string; notes?: string; account_id?: string }) => void;
}

export function IncomeForm({ open, onOpenChange, sources, accounts, editEntry, onAdd }: IncomeFormProps) {
  const [loading, setLoading] = useState(false);
  const [accountId, setAccountId] = useState("");
  const isEditing = !!editEntry;

  // Sync accountId from editEntry when modal opens/changes
  useEffect(() => {
    setAccountId(editEntry?.account_id || "");
  }, [editEntry, open]);

  // Mirrors, not control: the inputs stay uncontrolled (defaultValue + FormData
  // at submit) and these track emptiness for the submit-button state only.
  // Synced the same way on open/change, so edit mode starts enabled.
  const [amount, setAmount] = useState(editEntry?.amount ? String(editEntry.amount) : "");
  const [sourceId, setSourceId] = useState(editEntry?.source_id || "");
  const [date, setDate] = useState(editEntry?.date || toISODateString(new Date()));
  useEffect(() => {
    setAmount(editEntry?.amount ? String(editEntry.amount) : "");
    setSourceId(editEntry?.source_id || "");
    setDate(editEntry?.date || toISODateString(new Date()));
  }, [editEntry, open]);
  const requiredEmpty = !amount.trim() || !sourceId || !date;

  // Base UI needs the value -> label map up front. See expense-form.tsx for why
  // a Select without it prints the raw UUID into the trigger.
  const sourceLabels = Object.fromEntries(sources.map((s) => [s.id, s.name]));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      amount: Number(formData.get("amount")),
      source_id: formData.get("source_id") as string,
      date: formData.get("date") as string,
      notes: formData.get("notes") as string,
      account_id: accountId || undefined,
    };

    if (!isEditing && onAdd) {
      onAdd(data);
      onOpenChange(false);
      setLoading(false);
      return;
    }

    const result = isEditing
      ? await editIncome(editEntry.id, data)
      : await addIncome(data);

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(isEditing ? "Income updated" : "Income added");
      onOpenChange(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Income" : "Add Income"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount <span className="text-rose-500">*</span></Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              defaultValue={editEntry?.amount || ""}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source_id">Source <span className="text-rose-500">*</span></Label>
            <Select
              name="source_id"
              items={sourceLabels}
              defaultValue={editEntry?.source_id || ""}
              onValueChange={(v) => setSourceId(v ?? "")}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {sourceLabels[source.id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date <span className="text-rose-500">*</span></Label>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={editEntry?.date || toISODateString(new Date())}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Add a note..."
              defaultValue={editEntry?.notes || ""}
              rows={3}
            />
          </div>

          {accounts && accounts.length > 0 && (
            <AccountSelect
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
            />
          )}

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            {/* Disabled on required-EMPTY, never on invalid: an empty field
                teaches nothing, while a filled-but-bad amount (0) must stay
                submittable so the native-min bubble teaches what is wrong. */}
            <Button type="submit" className="flex-1" disabled={loading || requiredEmpty}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save changes" : "Add income"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
