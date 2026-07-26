"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addBudget } from "@/app/(dashboard)/budgets/actions";
import type { ExpenseCategory } from "@/lib/types";

interface BudgetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategory[];
  month: number;
  year: number;
}

export function BudgetForm({ open, onOpenChange, categories, month, year }: BudgetFormProps) {
  const [loading, setLoading] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, number>>({});

  function handleAmountChange(categoryId: string, val: string) {
    setAmounts((prev) => ({
      ...prev,
      [categoryId]: Math.max(0, Number(val) || 0),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const categoryList = categories
      .map((c) => ({
        category_id: c.id,
        amount: amounts[c.id] || 0,
      }))
      .filter((c) => c.amount > 0);

    if (categoryList.length === 0) {
      toast.error("Set a budget limit for at least one category");
      setLoading(false);
      return;
    }

    const result = await addBudget({
      month,
      year,
      categories: categoryList,
    });

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Budget created successfully");
      onOpenChange(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Monthly Budget</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-3">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between gap-4 p-2 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  {cat.icon && <span>{cat.icon}</span>}
                  <Label htmlFor={`cat-${cat.id}`} className="text-sm font-medium">
                    {cat.name}
                  </Label>
                </div>
                <div className="w-32">
                  <Input
                    id={`cat-${cat.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={amounts[cat.id] ?? ""}
                    onChange={(e) => handleAmountChange(cat.id, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Budget
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
