"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { getAccountQrUrl } from "@/app/(dashboard)/accounts/actions";

interface QrDisplayModalProps {
  account: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Fullscreen receive-QR display. White mat in BOTH schemes - scanners need
 * the contrast, and the app's dark surface is the wrong canvas. Not inverted,
 * not themed, on purpose.
 *
 * Wake Lock keeps the screen on while someone scans: requested on open,
 * released on close/unmount, re-acquired on visibilitychange (browsers drop
 * it in background). Absent API degrades silently - the display never
 * depends on it.
 */
export function QrDisplayModal({ account, open, onOpenChange }: QrDisplayModalProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || !account) return;
    let live = true;
    setUrl(null);
    setFailed(false);
    getAccountQrUrl(account.id).then((res) => {
      if (!live) return;
      if (res.success) setUrl(res.url);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [open, account]);

  useEffect(() => {
    if (!open) return;
    let lock: { release: () => Promise<void> } | null = null;
    let live = true;
    const acquire = async () => {
      try {
        if (!("wakeLock" in navigator)) return;
        const next = await (navigator as Navigator & {
          wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> };
        }).wakeLock.request("screen");
        if (live) {
          lock = next;
          console.info("[qr-display] wake lock acquired");
        } else {
          await next.release();
        }
      } catch {
        // Absent or denied: the display degrades silently, never blocks.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && open) void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisible);
      if (lock) {
        console.info("[qr-display] wake lock released");
        void lock.release().catch(() => {});
        lock = null;
      }
    };
  }, [open ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* White backdrop AND white popup: the whole viewport is the mat.
            Tailwind-merge resolves the base bg-black/10, bg-popover, ring-1
            and rounded-xl to these - verified, not assumed. Safe-area padding
            keeps the QR clear of the notch and home indicator. */}
        <DialogOverlay className="bg-white" />
        <DialogContent
          className="inset-0 top-0 left-0 h-dvh w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-white p-0 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] shadow-none ring-0 sm:max-w-none"
          aria-label={account ? `Receive QR for ${account.name}` : "Receive QR"}
        >
          <div className="flex h-full flex-col items-center bg-white">
            <p className="pt-6 text-sm font-semibold text-neutral-800">
              {account?.name}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Show this code to receive money
            </p>
            {/* w-full: inside the centered column this wrapper would otherwise
                shrink-to-fit, capping the image at its intrinsic width no
                matter what min() computes. */}
            <div className="flex w-full flex-1 items-center justify-center p-[10%]">
              {!url && !failed && (
                <Loader2 className="h-8 w-8 animate-spin text-neutral-400" aria-label="Loading QR code" />
              )}
              {failed && (
                <div className="space-y-3 text-center">
                  <p className="text-sm text-neutral-600">
                    Couldn&apos;t load the QR code right now.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setFailed(false);
                      if (account) {
                        getAccountQrUrl(account.id).then((res) => {
                          if (res.success) setUrl(res.url);
                          else setFailed(true);
                        });
                      }
                    }}
                    className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800"
                  >
                    Retry
                  </button>
                </div>
              )}
              {url && (
                // Keyed by URL: a re-uploaded QR never shows stale bytes.
                // Explicit width (not w-full): inside the shrink-to-fit flex
                // column, w-full resolves to the intrinsic width and a large
                // viewport gets a small image. min() floor keeps 260px at 390.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={`Receive QR code for ${account?.name ?? "account"}`}
                  className="h-auto w-[min(80vmin,100%)] min-w-[260px] rounded-lg"
                />
              )}
            </div>
            <p className="pb-8 text-[11px] text-neutral-400">
              Tap outside or × to close
            </p>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
