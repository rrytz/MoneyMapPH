"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { getAccountQrUrl } from "@/app/(dashboard)/accounts/actions";
import { getQrBlob, putQrBlob } from "@/lib/qr-cache";

interface QrDisplayModalProps {
  account: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Network leg of the load, shared by initial open, online-retry and manual
 * Retry: mint a signed URL, download the bytes, cache them. Throws on any
 * failure so all three callers share one error path instead of three copies.
 */
async function fetchAndCacheQr(accountId: string): Promise<Blob> {
  const res = await getAccountQrUrl(accountId);
  if (!res.success || !("url" in res) || !res.url) {
    throw new Error("signed URL failed");
  }
  const fetched = await fetch(res.url);
  if (!fetched.ok) throw new Error("download failed");
  const blob = await fetched.blob();
  await putQrBlob(accountId, blob);
  return blob;
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
  // null = loading, "offline" = cached-miss without connectivity, "fetch" = failed fetch.
  const [loadError, setLoadError] = useState<null | "offline" | "fetch">(null);
  const objectUrlRef = useRef<string | null>(null);

  // Cache-first load. Hit renders instantly with no fetch; miss downloads and
  // stores. Offline + miss is its own named state, not the generic error.
  useEffect(() => {
    if (!open || !account) return;
    let live = true;
    setUrl(null);
    setLoadError(null);
    const revoke = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
    const showBlob = (blob: Blob) => {
      if (!live) return;
      revoke();
      objectUrlRef.current = URL.createObjectURL(blob);
      setUrl(objectUrlRef.current);
    };
    (async () => {
      const cached = await getQrBlob(account.id);
      if (!live) return;
      if (cached) {
        showBlob(cached);
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setLoadError("offline");
        return;
      }
      try {
        showBlob(await fetchAndCacheQr(account.id));
      } catch {
        if (live) setLoadError("fetch");
      }
    })();
    return () => {
      live = false;
      revoke();
    };
  }, [open, account]);

  // While open in the offline-error state, re-attempt when connectivity
  // returns. Browsers without the online event keep the manual Retry.
  useEffect(() => {
    if (!open || loadError !== "offline" || !account) return;
    const retry = () => {
      if (navigator.onLine) {
        setLoadError(null);
        fetchAndCacheQr(account.id)
          .then((blob) => {
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = URL.createObjectURL(blob);
            setUrl(objectUrlRef.current);
          })
          .catch(() => setLoadError("fetch"));
      }
    };
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [open, loadError, account]);

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
              {!url && !loadError && (
                <Loader2 className="h-8 w-8 animate-spin text-neutral-400" aria-label="Loading QR code" />
              )}
              {loadError && (
                <div className="space-y-3 text-center">
                  <p className="text-sm text-neutral-600">
                    {loadError === "offline"
                      ? "No cached QR. Connect to the internet to view."
                      : "Couldn't load the QR code right now."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      // Re-run the full load: cache, then network. A retry that
                      // skipped the cache could show stale bytes by construction.
                      setLoadError(null);
                      setUrl(null);
                      if (!account) return;
                      const id = account.id;
                      (async () => {
                        const cached = await getQrBlob(id);
                        if (cached) {
                          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                          objectUrlRef.current = URL.createObjectURL(cached);
                          setUrl(objectUrlRef.current);
                          return;
                        }
                        if (typeof navigator !== "undefined" && !navigator.onLine) {
                          setLoadError("offline");
                          return;
                        }
                        try {
                          const blob = await fetchAndCacheQr(id);
                          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
                          objectUrlRef.current = URL.createObjectURL(blob);
                          setUrl(objectUrlRef.current);
                        } catch {
                          setLoadError("fetch");
                        }
                      })();
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
                  // pixelated, not smoothed: QR modules are binary edges, and
                  // smoothing invents gray between them. Nearest-neighbor keeps
                  // edges crisp at any upscale. Cosmetic for photos, load-bearing
                  // for codes.
                  className="h-auto w-[min(80vmin,100%)] min-w-[260px] rounded-lg [image-rendering:pixelated]"
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
