/**
 * QR byte cache: explicit IndexedDB keyed on account_id.
 *
 * Why not the service worker: signed URLs rotate, so SW caching on full URL
 * hits only until rotation, and stripping the query to key on path means
 * custom cache-key plumbing plus invalidation signals on replace/remove -
 * more moving parts than the thing it replaces, inside a shared config every
 * request flows through. The SW file deliberately fences Supabase traffic to
 * NetworkOnly; this stays out of it.
 *
 * Why not a dep (idb/dexie): one store, three operations. A promise wrapper
 * is ~40 lines; a dependency is forever.
 *
 * iOS boundary, stated not solved: browsers may evict IndexedDB under storage
 * pressure. A miss falls back to network, so eviction degrades to a spinner,
 * never a dead screen. The cache is a performance optimization, not a
 * guarantee - do not build correctness on its presence.
 */

const DB_NAME = "moneymap-qr";
const STORE = "qr-bytes";

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("open failed"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await db();
  try {
    const tx = database.transaction(STORE, mode);
    const result = await new Promise<T>((resolve, reject) => {
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("request failed"));
    });
    return result;
  } finally {
    database.close();
  }
}

/** Raw bytes for an account, or null on miss/unavailable. Never throws. */
export async function getQrBlob(accountId: string): Promise<Blob | null> {
  try {
    const blob = await withStore("readonly", (s) => s.get(accountId));
    return blob instanceof Blob ? blob : null;
  } catch {
    return null;
  }
}

/** Store (or overwrite) an account's QR bytes. Failures are silent - the
 *  network path still works, so a failed write must never break display. */
export async function putQrBlob(accountId: string, blob: Blob): Promise<void> {
  try {
    await withStore("readwrite", (s) => s.put(blob, accountId));
  } catch {
    // Cache is optimization, not guarantee (see above).
  }
}

/** Drop an account's bytes. Called on QR replace/remove; never throws. */
export async function deleteQrBlob(accountId: string): Promise<void> {
  try {
    await withStore("readwrite", (s) => s.delete(accountId));
  } catch {
    // Absent or unavailable store: nothing to drop.
  }
}
