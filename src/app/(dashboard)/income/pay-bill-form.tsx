"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatDate } from "@/lib/utils/date";
import { payBill, unpayBill } from "./bills/actions";
import type { BillOccurrence, ExpenseCategory } from "@/lib/types";

export function PayBillForm({
  open,
  onClose,
  occurrence,
  paidPaymentId,
  categoryId,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  occurrence: BillOccurrence & { paid: boolean; overdue: boolean };
  paidPaymentId?: string;
  categoryId: string | null;
  categories: ExpenseCategory[];
}) {
  const [amount, setAmount] = useState(String(occurrence.expectedAmount));
  const [selectedCategory, setSelectedCategory] = useState(categoryId ?? "");
  const [paidAt, setPaidAt] = useState(formatDate(new Date(), "yyyy-MM-dd"));
  const [busy, setBusy] = useState(false);
  const unpay = Boolean(paidPaymentId);

  if (!open) return null;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    if (paidPaymentId) {
      const res = await unpayBill({ paymentId: paidPaymentId });
      setBusy(false);
      if (res.error) return toast.error(res.error);
      toast.success("Payment removed");
      onClose();
      return;
    }
    const res = await payBill({
      billId: occurrence.bill_id,
      dueDate: occurrence.dueDate,
      paidAt,
      amount: Number(amount),
      categoryId: selectedCategory,
    });
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(`${occurrence.billName} paid`);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form className="w-full max-w-sm rounded-2xl bg-background p-5 space-y-4" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div>
          <h3 className="text-sm font-semibold">
            {unpay ? `Unpay ${occurrence.billName}` : `Pay ${occurrence.billName}`}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            Due {formatDate(occurrence.dueDate, "MMM d, yyyy")} · expected{" "}
            <CurrencyDisplay amount={occurrence.expectedAmount} className="inline font-semibold" />
          </p>
        </div>

        {unpay ? (
          <p className="text-xs text-muted-foreground">
            This marks the payment as removed and frees the amount for this cutoff.
          </p>
        ) : (
          <>
            <label className="text-xs font-medium text-foreground">Amount paid</label>
            <Input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <select
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <label className="text-xs font-medium text-foreground">Paid date</label>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required />
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            disabled={busy}
            variant={unpay ? "destructive" : "default"}
            className={unpay ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {busy ? (unpay ? "Removing…" : "Saving…") : unpay ? "Unpay" : "Log payment"}
          </Button>
        </div>
      </form>
    </div>
  );
}