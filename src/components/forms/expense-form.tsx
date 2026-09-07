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
import { addExpense, editExpense } from "@/app/(dashboard)/expenses/actions";
import type { Expense, ExpenseCategory } from "@/lib/types";
import { toISODateString } from "@/lib/utils/date";

interface ExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategory[];
  editEntry?: Expense | null;
  onAdd?: (data: { title: string; amount: number; category_id: string; date: string; notes?: string }) => void;
}

export function ExpenseForm({ open, onOpenChange, categories, editEntry, onAdd }: ExpenseFormProps) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!editEntry;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      amount: Number(formData.get("amount")),
      category_id: formData.get("category_id") as string,
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
      ? await editExpense(editEntry.id, data)
      : await addExpense(data);

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(isEditing ? "Expense updated" : "Expense added");
      onOpenChange(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Expense" : "Add Expense"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="What did you spend on?"
              defaultValue={editEntry?.title || ""}
              required
            />
          </div>

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
            <Label htmlFor="category_id">Category</Label>
            <Select name="category_id" defaultValue={editEntry?.category_id || ""} required>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center gap-2">
                      {cat.icon && <span>{cat.icon}</span>}
                      {cat.name}
                    </span>
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
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Save changes" : "Add expense"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
