import { describe, it, expect, vi, beforeEach } from "vitest";
import { revalidateTag } from "next/cache";
import {
  FINANCIAL_TAG_SUFFIXES,
  buildFinancialTags,
  revalidateUserFinancialCache,
  tagFor,
  CACHE_TAG_PREFIX,
  GLOBAL_FINANCIAL_TAG,
  type FinancialTagSuffix,
} from "@/lib/cache/tags";

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

const USER_ID = "user-42";

describe("tag schema", () => {
  it("has a stable prefix and per-user suffix format", () => {
    expect(CACHE_TAG_PREFIX).toBe("q");
    expect(tagFor("summary", USER_ID)).toBe("q:summary:user-42");
  });

  it("has unique suffixes so no two caches share a per-user stamp", () => {
    expect(new Set(FINANCIAL_TAG_SUFFIXES).size).toBe(FINANCIAL_TAG_SUFFIXES.length);
  });
});

describe("buildFinancialTags", () => {
  it("stamps user-scoped-only caches (categories/sources/bills) without the global tag", () => {
    expect(buildFinancialTags(USER_ID, "categories")).toEqual(["q:categories:user-42"]);
    expect(buildFinancialTags(USER_ID, "sources")).toEqual(["q:sources:user-42"]);
    expect(buildFinancialTags(USER_ID, "bills")).toEqual(["q:bills:user-42"]);
  });

  it("stamps the remaining caches with the per-user tag plus the global umbrella tag", () => {
    const globalTagged = FINANCIAL_TAG_SUFFIXES.filter(
      (s) => !["categories", "sources", "bills"].includes(s)
    ) as FinancialTagSuffix[];
    for (const suffix of globalTagged) {
      expect(buildFinancialTags(USER_ID, suffix)).toEqual([`q:${suffix}:user-42`, GLOBAL_FINANCIAL_TAG]);
    }
  });
});

describe("revalidateUserFinancialCache", () => {
  beforeEach(() => vi.clearAllMocks());

  it("purges every per-user financial tag with immediate expiration", () => {
    revalidateUserFinancialCache(USER_ID);

    expect(revalidateTag).toHaveBeenCalledTimes(FINANCIAL_TAG_SUFFIXES.length);
    for (const suffix of FINANCIAL_TAG_SUFFIXES) {
      expect(revalidateTag).toHaveBeenCalledWith(`q:${suffix}:user-42`, { expire: 0 });
    }
  });

  it("does not touch other users' tags", () => {
    revalidateUserFinancialCache(USER_ID);
    const touchedTags = vi.mocked(revalidateTag).mock.calls.map((c) => c[0]);
    expect(touchedTags.every((t) => t.endsWith(":user-42"))).toBe(true);
  });
});