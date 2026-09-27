"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatDate } from "@/lib/utils/date";
import { payBill, unpayBill } from "./bills/actions";
import type { BillOccurrence, ExpenseCategory } from "@/lib/types";

export function PayBillForm({
  onClose,
  occurrence,
  paidPaymentId,
  categoryId,
  categories,
}: {
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

  // This was a hand-rolled overlay: a fixed inset-0 div with a form inside, no
  // role="dialog", no aria-modal, no focus trap, and no Escape. Tab walked
  // straight out of the "modal" into the page behind it, and a screen reader
  // announced a bare form rather than a dialog.
  //
  // It is the shared Dialog now, which is also the bill-creation Sheet's
  // primitive, so the two modals are one idiom. Everything the old version had
  // to do by hand comes from the primitive instead: the portal, the backdrop
  // click, Escape, focus trapping, focus restore, and the dialog role. Two
  // closures instead of three - the primitive does not let a stray inside click
  // bubble out to the backdrop - and the labels are now wired to their inputs.
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {unpay ? `Unpay ${occurrence.billName}` : `Pay ${occurrence.billName}`}
          </DialogTitle>
          <DialogDescription>
            Due {formatDate(occurrence.dueDate, "MMM d, yyyy")} · expected{" "}
            <CurrencyDisplay
              amount={occurrence.expectedAmount}
              className="figure-inline inline font-semibold"
            />
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          {unpay ? (
            <p className="text-xs text-muted-foreground">
              This marks the payment as removed and frees the amount for this cutoff.
            </p>
          ) : (
            <>
              <div className="space-y-1.5">
                <label htmlFor="pay-amount" className="text-xs font-medium text-foreground">
                  Amount paid
                </label>
                <Input
                  id="pay-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="pay-category" className="text-xs font-medium text-foreground">
                  Category
                </label>
                <select
                  id="pay-category"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="pay-date" className="text-xs font-medium text-foreground">
                  Paid date
                </label>
                <Input
                  id="pay-date"
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
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
      </DialogContent>
    </Dialog>
  );
}
