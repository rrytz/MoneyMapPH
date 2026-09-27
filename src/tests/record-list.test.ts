import { describe, expect, it } from "vitest";
import { recordPrimaryLabel } from "@/components/shared/record-list";

describe("a record row's primary line is never blank", () => {
  // The edge cases, not the happy path. A row whose title and category are both
  // empty renders as a figure floating beside nothing, which reads as a broken
  // row rather than a nameless one - so the label falls back, in order of what
  // is actually known.
  it("prefers the title", () => {
    expect(recordPrimaryLabel({ title: "Groceries", categoryName: "Food", type: "expense" }))
      .toBe("Groceries");
  });

  it("falls back to the category when there is no title", () => {
    expect(recordPrimaryLabel({ title: "", categoryName: "Utilities", type: "expense" }))
      .toBe("Utilities");
    expect(recordPrimaryLabel({ title: null, categoryName: "Utilities", type: "expense" }))
      .toBe("Utilities");
  });

  it("falls back to the type when title AND category are empty", () => {
    // The case the table never had to handle, because a table cell can be empty
    // without looking broken. A list row cannot.
    expect(recordPrimaryLabel({ title: "", categoryName: "", type: "expense" })).toBe("Expense");
    expect(recordPrimaryLabel({ title: "  ", categoryName: "  ", type: "income" })).toBe("Income");
  });

  it("handles a completely undefined row rather than rendering nothing", () => {
    expect(recordPrimaryLabel({})).toBe("Record");
    expect(recordPrimaryLabel({ type: "something-else" })).toBe("Record");
  });

  it("never returns an empty or whitespace string, for any input", () => {
    const inputs: Parameters<typeof recordPrimaryLabel>[0][] = [
      {}, { title: "" }, { title: "   " }, { title: null, categoryName: "" },
      { title: null, categoryName: null }, { title: "", categoryName: null, type: "income" },
      { title: "\t\n", categoryName: " ", type: "expense" },
    ];
    for (const i of inputs) {
      const out = recordPrimaryLabel(i);
      expect(out.length, JSON.stringify(i)).toBeGreaterThan(0);
      expect(out.trim(), JSON.stringify(i)).toBe(out);
      expect(out.trim().length, JSON.stringify(i)).toBeGreaterThan(0);
    }
  });
});
