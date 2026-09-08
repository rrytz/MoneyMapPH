"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addPaycheck } from "@/app/(dashboard)/income/actions";
import { AllocationEditor, type AllocationItem } from "./allocation-editor";
import type { ExpenseCategory } from "@/lib/types";
import { parseISO } from "date-fns";
import { toISODateString, formatDate } from "@/lib/utils/date";
import { CUTOFF_ANCHOR_DAYS, estimatePeriodEndForPayout, getCutoffPeriodForDate } from "@/lib/utils/pay-period";

interface PaycheckFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ExpenseCategory[];
}

export function PaycheckForm({ open, onOpenChange, categories }: PaycheckFormProps) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number>(0);
  const [allocations, setAllocations] = useState<AllocationItem[]>([]);
  const [payDate, setPayDate] = useState<string>(toISODateString(new Date()));
  const [overridePeriodEnd, setOverridePeriodEnd] = useState<string | null>(null);

  const inferredPeriodEnd = toISODateString(estimatePeriodEndForPayout(parseISO(payDate)));
  const cutoff = overridePeriodEnd ?? inferredPeriodEnd;
  const cutoffDate = parseISO(cutoff);
  const periodRange = getCutoffPeriodForDate(cutoffDate);
  const cutoffOptions = CUTOFF_ANCHOR_DAYS.map((d) =>
    toISODateString(new Date(cutoffDate.getFullYear(), cutoffDate.getMonth(), d))
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const paycheckData = {
      name: formData.get("name") as string,
      amount: Number(formData.get("amount")),
      date: formData.get("date") as string,
      period_end: cutoff,
      notes: formData.get("notes") as string,
      allocations: allocations.map((a) => ({
        label: a.label,
        category_id: a.category_id,
        amount: Number(a.amount),
      })),
    };

    const result = await addPaycheck(paycheckData);
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Paycheck created successfully");
      onOpenChange(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Paycheck Planner</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="name">Paycheck Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. July 15 Salary, Freelance Payment"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Paycheck Amount</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date Received</Label>
            <Input
              id="date"
              name="date"
              type="date"
              value={payDate}
              onChange={(e) => {
                setPayDate(e.target.value);
                setOverridePeriodEnd(null);
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cutoff">Cutoff</Label>
            <select
              id="cutoff"
              name="cutoff"
              value={cutoff}
              onChange={(e) => setOverridePeriodEnd(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none"
            >
              {cutoffOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {formatDate(opt, "MMM d, yyyy")}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Work period {formatDate(periodRange.periodStart, "MMM d")} – {formatDate(periodRange.periodEnd, "MMM d")}
            </p>
          </div>

          <AllocationEditor
            paycheckAmount={amount}
            allocations={allocations}
            onChange={setAllocations}
            categories={categories}
          />

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Add notes..."
              rows={2}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Paycheck Plan
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
