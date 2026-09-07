"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";

interface BudgetExpenseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: { id: string; name: string; icon: string | null } | null;
  viewedMonthLabel: string;
  defaultDate: string;
  onAdd: (data: { title: string; amount: number; category_id: string; date: string; notes?: string }) => void;
}

export function BudgetExpenseForm({
  open,
  onOpenChange,
  category,
  viewedMonthLabel,
  defaultDate,
  onAdd,
}: BudgetExpenseFormProps) {
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!category) return;
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const description = (formData.get("description") as string).trim();
    const data = {
      title: description || `${category.name} expense`,
      amount: Number(formData.get("amount")),
      category_id: category.id,
      date: formData.get("date") as string,
      notes: "",
    };

    onAdd(data);
    onOpenChange(false);
    setLoading(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add Expense</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
              {category?.icon && <span>{category.icon}</span>}
              <span>{category?.name}</span>
            </div>
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
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              name="description"
              placeholder="What did you spend on?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={defaultDate}
              required
            />
            <p className="text-[11px] text-muted-foreground">
              Counts toward {viewedMonthLabel} spend.
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add expense
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}