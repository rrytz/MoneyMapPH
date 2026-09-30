"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { addAccount, editAccount } from "@/app/(dashboard)/accounts/actions";
import type { AccountWithBalance, AccountType } from "@/lib/types";

interface AccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editAccountData?: AccountWithBalance | null;
}

/**
 * Base UI value -> label map. Without it a pre-populated Select renders its raw
 * value ("bank") in the trigger rather than "Bank Account".
 * See expense-form.tsx for the full explanation.
 */
const ACCOUNT_TYPE_LABELS = {
  bank: "Bank Account",
  ewallet: "E-Wallet (GCash, Maya)",
  digital_bank: "Digital Bank (GoTyme, SeaBank)",
  cash: "Cash Reserves",
  credit: "Credit Line (Ledger Only)",
};

export function AccountModal({ open, onOpenChange, editAccountData }: AccountModalProps) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("bank");
  const [initialBalance, setInitialBalance] = useState("");
  const isEditing = !!editAccountData;

  useEffect(() => {
    if (editAccountData) {
      setName(editAccountData.name);
      setType(editAccountData.type);
      setInitialBalance(editAccountData.initial_balance.toString());
    } else {
      setName("");
      setType("bank");
      setInitialBalance("0");
    }
  }, [editAccountData, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const data = {
      name,
      type,
      initial_balance: Number(initialBalance) || 0,
    };

    const res = isEditing
      ? await editAccount(editAccountData.id, data)
      : await addAccount(data);

    setLoading(false);

    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(isEditing ? "Account updated" : "Account created");
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Account" : "Add New Account"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="account-name">Account Name</Label>
            <Input
              id="account-name"
              placeholder="e.g. UnionBank Savings, GCash"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-type">Account Type</Label>
            <Select value={type} onValueChange={(val) => setType(val as AccountType)} items={ACCOUNT_TYPE_LABELS}>
              <SelectTrigger>
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">{ACCOUNT_TYPE_LABELS.bank}</SelectItem>
                <SelectItem value="ewallet">{ACCOUNT_TYPE_LABELS.ewallet}</SelectItem>
                <SelectItem value="digital_bank">{ACCOUNT_TYPE_LABELS.digital_bank}</SelectItem>
                <SelectItem value="cash">{ACCOUNT_TYPE_LABELS.cash}</SelectItem>
                <SelectItem value="credit">{ACCOUNT_TYPE_LABELS.credit}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-ink-faint">
              Note: Credit type is for visual categorization. Its balance uses standard ledger math.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="initial-balance">Starting Balance (₱)</Label>
            <Input
              id="initial-balance"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              required
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : isEditing ? "Update Account" : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
