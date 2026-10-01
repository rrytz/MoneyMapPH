"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { addTransfer, editTransfer } from "@/app/(dashboard)/accounts/actions";
import type { AccountWithBalance, AccountTransfer } from "@/lib/types";
import { getManilaNow, toISODateString } from "@/lib/utils/date";

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountWithBalance[];
  editTransferData?: AccountTransfer | null;
  defaultSourceAccountId?: string;
}

export function TransferModal({
  open,
  onOpenChange,
  accounts,
  editTransferData,
  defaultSourceAccountId,
}: TransferModalProps) {
  const [loading, setLoading] = useState(false);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("0");
  const [date, setDate] = useState(toISODateString(getManilaNow()));
  const [notes, setNotes] = useState("");

  const isEditing = !!editTransferData;
  const activeAccounts = accounts.filter((a) => !a.is_archived);

  // Base UI value -> label map for the two account Selects below. Without it
  // each prints the account's raw UUID into the trigger. See expense-form.tsx.
  const accountLabels = Object.fromEntries(
    activeAccounts.map((a) => [
      a.id,
      `${a.name} (Bal: ₱${a.current_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })})`,
    ])
  );

  useEffect(() => {
    if (editTransferData) {
      setFromAccountId(editTransferData.from_account_id);
      setToAccountId(editTransferData.to_account_id);
      setAmount(editTransferData.amount.toString());
      setFee(editTransferData.transfer_fee.toString());
      setDate(editTransferData.date);
      setNotes(editTransferData.notes || "");
    } else {
      const defaultFrom = defaultSourceAccountId || activeAccounts[0]?.id || "";
      const defaultTo = activeAccounts.find((a) => a.id !== defaultFrom)?.id || "";
      setFromAccountId(defaultFrom);
      setToAccountId(defaultTo);
      setAmount("");
      setFee("0");
      setDate(toISODateString(getManilaNow()));
      setNotes("");
    }
  }, [editTransferData, defaultSourceAccountId, open]);

  const sourceAccount = accounts.find((a) => a.id === fromAccountId);
  const destAccount = accounts.find((a) => a.id === toAccountId);
  const numAmount = Number(amount) || 0;
  const numFee = Number(fee) || 0;
  const totalDeduction = numAmount + numFee;

  const todayStr = toISODateString(getManilaNow());
  const isDateTodayOrPast = date <= todayStr;
  const willOverdrawSource =
    isDateTodayOrPast && sourceAccount && sourceAccount.current_balance - totalDeduction < 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      amount: numAmount,
      transfer_fee: numFee,
      date,
      notes,
    };

    const res = isEditing
      ? await editTransfer(editTransferData.id, payload)
      : await addTransfer(payload);

    setLoading(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(isEditing ? "Transfer updated" : "Transfer logged");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Internal Transfer" : "Transfer Money Between Accounts"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>From Account (Source) <span className="text-rose-500">*</span></Label>
            <Select value={fromAccountId} onValueChange={(v) => setFromAccountId(v ?? "")} items={accountLabels}>
              <SelectTrigger>
                <SelectValue placeholder="Select source account" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {accountLabels[acc.id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>To Account (Destination) <span className="text-rose-500">*</span></Label>
            <Select value={toAccountId} onValueChange={(v) => setToAccountId(v ?? "")} items={accountLabels}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination account" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts
                  .filter((acc) => acc.id !== fromAccountId)
                  .map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {accountLabels[acc.id]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Transfer Amount (₱) <span className="text-rose-500">*</span></Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fee">Transfer Fee (₱)</Label>
              <Input
                id="fee"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </div>
          </div>

          {/* Fee & Impact Breakdown */}
          {numAmount > 0 && sourceAccount && destAccount && (
            <div className="rounded-lg bg-muted/60 p-3 text-xs space-y-1.5 border border-border">
              <div className="flex justify-between text-muted-foreground">
                <span>Transfer Amount:</span>
                <span>₱{numAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Fee:</span>
                <span>₱{numFee.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-medium text-rose-400 border-t border-border pt-1">
                <span>Source ({sourceAccount.name}) impact:</span>
                <span>-₱{totalDeduction.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-medium text-sulpot-bright">
                <span>Destination ({destAccount.name}) impact:</span>
                <span>+₱{numAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          {/* Policy 2 Non-blocking Warning Callout */}
          {willOverdrawSource && (
            <div className="rounded-lg bg-muted/60 border border-amber-500/30 p-3 text-xs text-amber-600 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <strong>Informational Warning:</strong> This transfer will result in a negative balance (-₱
                {Math.abs(sourceAccount!.current_balance - totalDeduction).toLocaleString("en-US", { minimumFractionDigits: 2 })}) on <strong>{sourceAccount!.name}</strong>. Proceeding is allowed.
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="date">Date <span className="text-rose-500">*</span></Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Input
              id="notes"
              placeholder="e.g., Cash-in fee, wallet transfer"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {/* Disabled on required-EMPTY, never on invalid: an empty amount
                teaches nothing ("fill it in"), while a filled-but-bad one
                (0, negative) must stay submittable so the-native-min bubble
                or the handler guard can teach what is wrong. */}
            <Button type="submit" disabled={loading || !amount.trim() || !fromAccountId || !toAccountId || !date}>
              {loading ? "Processing..." : isEditing ? "Update Transfer" : "Confirm Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
