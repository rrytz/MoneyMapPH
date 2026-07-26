"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import type { ExpenseCategory } from "@/lib/types";

export interface AllocationItem {
  id: string;
  label: string;
  category_id?: string;
  amount: number;
}

interface AllocationEditorProps {
  paycheckAmount: number;
  allocations: AllocationItem[];
  onChange: (allocations: AllocationItem[]) => void;
  categories: ExpenseCategory[];
}

export function AllocationEditor({
  paycheckAmount,
  allocations,
  onChange,
  categories,
}: AllocationEditorProps) {
  const totalAllocated = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const remaining = paycheckAmount - totalAllocated;
  const percentage = paycheckAmount > 0 ? (totalAllocated / paycheckAmount) * 100 : 0;

  function handleAdd() {
    onChange([
      ...allocations,
      { id: crypto.randomUUID(), label: "", amount: 0 },
    ]);
  }

  function handleRemove(id: string) {
    onChange(allocations.filter((a) => a.id !== id));
  }

  function handleUpdate(id: string, field: keyof AllocationItem, value: any) {
    onChange(
      allocations.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  }

  return (
    <div className="space-y-4 border border-border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">Paycheck Allocations</h4>
          <p className="text-xs text-muted-foreground">Divide this paycheck into goals/expenses</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Allocation
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span>Allocated: <CurrencyDisplay amount={totalAllocated} /></span>
          <span className={remaining < 0 ? "text-danger font-semibold" : "text-muted-foreground"}>
            Unallocated: <CurrencyDisplay amount={remaining} />
          </span>
        </div>
        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${remaining < 0 ? "bg-danger" : "bg-primary"}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>

      <div className="space-y-3 pt-2">
        {allocations.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <Input
              placeholder="Label (e.g. Rent, Savings)"
              value={item.label}
              onChange={(e) => handleUpdate(item.id, "label", e.target.value)}
              className="flex-1"
            />
            <Select
              value={item.category_id || "none"}
              onValueChange={(val) => handleUpdate(item.id, "category_id", val === "none" ? undefined : val)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Category</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={item.amount || ""}
              onChange={(e) => handleUpdate(item.id, "amount", Number(e.target.value))}
              className="w-28"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-destructive shrink-0"
              onClick={() => handleRemove(item.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
