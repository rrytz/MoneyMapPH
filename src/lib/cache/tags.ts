import { revalidateTag } from "next/cache";

/**
 * Single source of truth for per-user financial cache tags.
 *
 * Every cached financial query in shared-queries.ts stamps its unstable_cache
 * entry with `q:<suffix>:<userId>`. Mutations call
 * revalidateUserFinancialCache(userId) so all affected entries are purged
 * immediately instead of waiting for REVALIDATE_SECONDS to expire.
 *
 * Naming a suffix here AND using it in shared-queries.ts keeps invalidation
 * and stamping in lockstep by construction; never hardcode a tag elsewhere.
 */

export const FINANCIAL_TAG_SUFFIXES = [
  "summary",
  "budgets",
  "snapshots",
  "categories",
  "sources",
  "goals",
  "paychecks",
  "lean",
  "safe-to-spend",
  "bills",
] as const;

export type FinancialTagSuffix = (typeof FINANCIAL_TAG_SUFFIXES)[number];

export const CACHE_TAG_PREFIX = "q";

export const GLOBAL_FINANCIAL_TAG = "q:financial";

// Suffixes that are user-scoped only (no global umbrella tag).
const USER_SCOPED_SUFFIXES: ReadonlySet<FinancialTagSuffix> = new Set([
  "categories",
  "sources",
  "bills",
]);

export function tagFor(suffix: FinancialTagSuffix, userId: string): string {
  return `${CACHE_TAG_PREFIX}:${suffix}:${userId}`;
}

/**
 * Tags stamped on a cached entry. Mirrors the pre-existing architecture:
 * most financial caches carry both the per-user tag and the global umbrella
 * tag; categories/sources/bills are user-scoped only.
 */
export function buildFinancialTags(userId: string, suffix: FinancialTagSuffix): string[] {
  const tags = [tagFor(suffix, userId)];
  if (!USER_SCOPED_SUFFIXES.has(suffix)) {
    tags.push(GLOBAL_FINANCIAL_TAG);
  }
  return tags;
}

/**
 * Purge every cached financial query for a user. Called from server actions
 * right after a money-mutating write. `{ expire: 0 }` expires the entries
 * immediately so the next read is a fresh cache miss (no stale flash).
 */
export function revalidateUserFinancialCache(userId: string): void {
  for (const suffix of FINANCIAL_TAG_SUFFIXES) {
    revalidateTag(tagFor(suffix, userId), { expire: 0 });
  }
}