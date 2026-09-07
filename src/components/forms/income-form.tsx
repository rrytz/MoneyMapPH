"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addIncome, editIncome } from "@/app/(dashboard)/income/actions";
import type { IncomeEntry, IncomeSource } from "@/lib/types";
import { toISODateString } from "@/lib/utils/date";

interface IncomeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sources: IncomeSource[];
  editEntry?: IncomeEntry | null;
  onAdd?: (data: { amount: number; source_id: string; date: string; notes?: string }) => void;
}

export function IncomeForm({ open, onOpenChange, sources, editEntry, onAdd }: IncomeFormProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!editEntry;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      amount: Number(formData.get("amount")),
      source_id: formData.get("source_id") as string,
      date: formData.get("date") as string,
      notes: formData.get("notes") as string,
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
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              defaultValue={editEntry?.amount || ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source_id">Source</Label>
            <Select name="source_id" defaultValue={editEntry?.source_id || ""} required>
              <SelectTrigger>
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={editEntry?.date || toISODateString(new Date())}
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
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save changes" : "Add income"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
