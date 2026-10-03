"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { addAccount, editAccount, uploadAccountQr, removeAccountQr, getAccountQrUrl } from "@/app/(dashboard)/accounts/actions";
import { putQrBlob, deleteQrBlob } from "@/lib/qr-cache";
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
  // Receive-QR state (edit mode only - a QR belongs to a saved account).
  // qrPath mirrors the DB column; qrUrl is a short-lived signed read.
  const [qrPath, setQrPath] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    if (editAccountData) {
      setName(editAccountData.name);
      setType(editAccountData.type);
      setInitialBalance(editAccountData.initial_balance.toString());
      setQrPath(editAccountData.qr_image_path || null);
    } else {
      setName("");
      setType("bank");
      setInitialBalance("0");
      setQrPath(null);
    }
    setQrUrl(null);
    setQrError(null);
  }, [editAccountData, open]);

  // Signed read URL for the thumbnail. Minted when the modal opens with a QR
  // on file - never cached, never public.
  useEffect(() => {
    if (!open || !qrPath || !editAccountData) return;
    let live = true;
    getAccountQrUrl(editAccountData.id).then((res) => {
      if (live && res.success) setQrUrl(res.url);
    });
    return () => { live = false; };
  }, [open, qrPath, editAccountData]);

  // Client pipeline: bytes-preserving by default. PNG/JPEG/WebP at or under
  // 2MB go up EXACTLY as received - no decode, no resize, no re-encode, so a
  // lossless source stays lossless (a 1024px QR PNG is typically smaller than
  // the 512px JPEG the old pipeline produced from the same source). Only
  // oversized input takes the processing path (decode, 1024px max, PNG out,
  // smoothing explicitly off - QR edges must not be interpolated). No HEIC
  // converter dependency: screenshots (the realistic QR source) are always
  // PNG, and the decode failure below names HEIC explicitly - that error
  // firing in practice is the evidence that would justify a converter.
  // Small sources stay small: a 400px upload stores 400px, and display
  // upscales. Deliberate - the source is the source, not an oversight.
  const QR_PASSTHROUGH_BYTES = 2 * 1024 * 1024;
  async function handleQrFile(file: File | undefined) {
    setQrError(null);
    if (!file || !editAccountData) return;
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    // HEIC is named before anything else: it fails decode AND magic bytes,
    // so without this it would fall through to the generic reject.
    if (
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      /\.heicf?$/i.test(file.name)
    ) {
      setQrError("Couldn't read this image. If it was saved as HEIC, re-save it as PNG and try again.");
      return;
    }
    if (file.type && !allowed.includes(file.type)) {
      setQrError("Please choose a PNG or JPEG image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setQrError("That image is too large (max 5 MB).");
      return;
    }
    setQrBusy(true);
    try {
      let payload: File;
      if (file.size <= QR_PASSTHROUGH_BYTES) {
        payload = file;
      } else {
        let bitmap: ImageBitmap;
        try {
          bitmap = await createImageBitmap(file);
        } catch {
          setQrError("Couldn't read this image. If it was saved as HEIC, re-save it as PNG and try again.");
          return;
        }
        const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx2d = canvas.getContext("2d");
        if (!ctx2d) throw new Error("canvas unavailable");
        // Bilinear default blurs module edges; QR content is binary.
        ctx2d.imageSmoothingEnabled = false;
        ctx2d.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/png")
        );
        if (!blob) throw new Error("encode failed");
        payload = new File([blob], "qr.png", { type: "image/png" });
      }
      const formData = new FormData();
      formData.append("file", payload);
      const res = await uploadAccountQr(editAccountData.id, formData);
      if (res.error || !res.success || !("path" in res) || !res.path) {
        setQrError(res.error || "Unable to save the QR code. Please try again.");
        return;
      }
      // Cache the bytes we already hold: the next display open must not pay
      // a download for bytes that just passed through here.
      await putQrBlob(editAccountData.id, payload);
      setQrPath(res.path);
      setQrUrl(null);
    } catch {
      setQrError("Unable to process that image. Please try again.");
    } finally {
      setQrBusy(false);
    }
  }

  async function handleQrRemove() {
    if (!editAccountData) return;
    setQrError(null);
    setQrBusy(true);
    const res = await removeAccountQr(editAccountData.id);
    setQrBusy(false);
    if (res.error) {
      setQrError(res.error);
      return;
    }
    // Clear the cache entry with the column: a removed QR must read as a
    // miss (offline error), never as stale bytes.
    await deleteQrBlob(editAccountData.id);
    setQrPath(null);
    setQrUrl(null);
  }

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
            <Label htmlFor="account-name">Account Name <span className="text-rose-500">*</span></Label>
            <Input
              id="account-name"
              placeholder="e.g. UnionBank Savings, GCash"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-type">Account Type <span className="text-rose-500">*</span></Label>
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
            <Label htmlFor="initial-balance">Starting Balance (₱) <span className="text-rose-500">*</span></Label>
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

          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="account-qr">Receive QR</Label>
              {qrPath ? (
                <div className="flex items-center gap-3">
                  {qrUrl ? (
                    <img src={qrUrl} alt="Receive QR code on file" className="h-16 w-16 rounded-lg border border-border object-contain bg-white" />
                  ) : (
                    <div className="h-16 w-16 rounded-lg border border-border bg-muted animate-pulse" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-xs text-muted-foreground truncate">QR code on file</p>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={qrBusy} onClick={() => document.getElementById("account-qr")?.click()}>
                        Replace
                      </Button>
                      <Button type="button" variant="ghost" size="sm" disabled={qrBusy} onClick={handleQrRemove} className="text-rose-500">
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No QR code yet. Upload the receive QR from the bank or e-wallet app.
                </p>
              )}
              <Input
                id="account-qr"
                type="file"
                accept="image/*"
                disabled={qrBusy}
                onChange={(e) => {
                  handleQrFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
                className="block w-full min-w-0 text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground cursor-pointer"
              />
              {qrError && (
                <p role="alert" className="text-xs text-rose-500">{qrError}</p>
              )}
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {/* Disabled on required-EMPTY: "0" stays submittable (a zero
                starting balance is legitimate, min="0"), empty does not. */}
            <Button type="submit" disabled={loading || !name.trim() || !initialBalance.trim()}>
              {loading ? "Saving..." : isEditing ? "Update Account" : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
