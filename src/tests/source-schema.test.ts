import { describe, it, expect } from "vitest";
import { sourceSchema } from "@/lib/utils/validators";

describe("sourceSchema", () => {
  it("defaults type to core", () => {
    const parsed = sourceSchema.parse({ name: "Salary" });
    expect(parsed.type).toBe("core");
  });

  it("accepts an explicit incentive type", () => {
    const parsed = sourceSchema.parse({ name: "Commission", type: "incentive" });
    expect(parsed.type).toBe("incentive");
  });

  it("rejects invalid source types", () => {
    expect(() => sourceSchema.parse({ name: "Bonus", type: "bonus" })).toThrow();
  });
});