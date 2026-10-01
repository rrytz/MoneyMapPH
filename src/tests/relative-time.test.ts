import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "@/lib/utils/date";

// formatRelativeTime: recency buckets for activity feeds.
const NOW = new Date("2026-10-01T12:00:00+08:00");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("formatRelativeTime", () => {
  it("says just now under a minute", () => {
    expect(formatRelativeTime(ago(30 * 1000), NOW)).toBe("just now");
  });

  it("counts minutes under an hour", () => {
    expect(formatRelativeTime(ago(2 * 60 * 1000), NOW)).toBe("2m ago");
    expect(formatRelativeTime(ago(59 * 60 * 1000), NOW)).toBe("59m ago");
  });

  it("counts hours under a day", () => {
    expect(formatRelativeTime(ago(2 * 3600 * 1000), NOW)).toBe("2h ago");
    expect(formatRelativeTime(ago(23 * 3600 * 1000), NOW)).toBe("23h ago");
  });

  it("names yesterday, then counts days under a week", () => {
    expect(formatRelativeTime(ago(26 * 3600 * 1000), NOW)).toBe("yesterday");
    expect(formatRelativeTime(ago(3 * 24 * 3600 * 1000), NOW)).toBe("3d ago");
    expect(formatRelativeTime(ago(6 * 24 * 3600 * 1000), NOW)).toBe("6d ago");
  });

  it("counts weeks under ~a month, then falls back to the absolute date", () => {
    expect(formatRelativeTime(ago(10 * 24 * 3600 * 1000), NOW)).toBe("1w ago");
    expect(formatRelativeTime(ago(21 * 24 * 3600 * 1000), NOW)).toBe("3w ago");
    expect(formatRelativeTime(ago(60 * 24 * 3600 * 1000), NOW)).toBe("Aug 2, 2026");
  });

  it("falls back to the absolute date for future or unparsable input", () => {
    expect(formatRelativeTime(new Date(NOW.getTime() + 60000), NOW)).toBe("Oct 1, 2026");
  });
});
