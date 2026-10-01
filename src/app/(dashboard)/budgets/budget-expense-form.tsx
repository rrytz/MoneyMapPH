"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { CategoryIcon } from "@/components/shared/category-icon";

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

  // Mirrors, not control: inputs stay uncontrolled and these track emptiness
  // for the submit-button state only. Same shape as income-form.tsx.
  const [amount, setAmount] = useState("");
  // Initialized from the prefilled default: the field shows a date on open,
  // so the mirror must too, or the button starts wrongly disabled.
  const [date, setDate] = useState(defaultDate);

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
              <CategoryIcon icon={category?.icon} className="h-4 w-4 text-muted-foreground" />
              <span>{category?.name}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount <span className="text-rose-500">*</span></Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              autoFocus
              onChange={(e) => setAmount(e.target.value)}
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
            <Label htmlFor="date">Date <span className="text-rose-500">*</span></Label>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={defaultDate}
              onChange={(e) => setDate(e.target.value)}
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
            {/* Disabled on required-EMPTY, never on invalid. */}
            <Button type="submit" className="flex-1" disabled={loading || !amount.trim() || !date}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add expense
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}