import { describe, it, expect } from "vitest";
import { getHealthHeroMessage } from "@/lib/utils/health-hero-copy";

type Grade = "Excellent" | "Good" | "Fair" | "Critical";

describe("getHealthHeroMessage — score-derived hero copy", () => {
  const gradeForScore = (score: number): Grade =>
    score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : "Critical";

  it("returns a distinct honest message per grade level", () => {
    const messages = [
      getHealthHeroMessage(90, gradeForScore(90)),
      getHealthHeroMessage(75, gradeForScore(75)),
      getHealthHeroMessage(63, gradeForScore(63)),
      getHealthHeroMessage(43, gradeForScore(43)),
    ];
    expect(new Set(messages).size).toBe(4);
  });

  it("never contains an invented peer-comparison claim", () => {
    const grades: Grade[] = ["Excellent", "Good", "Fair", "Critical"];
    for (const g of grades) {
      expect(getHealthHeroMessage(60, g)).not.toMatch(/\d+% of similar/);
      expect(getHealthHeroMessage(60, g)).not.toMatch(/better than \d/);
    }
  });

  it("Critical message is direct and non-punitive, no comparison", () => {
    const m = getHealthHeroMessage(43, "Critical");
    expect(m.toLowerCase()).toMatch(/st(art|ep)/);
    expect(m).not.toMatch(/82/);
  });

  it("healthy message is encouraging", () => {
    const m = getHealthHeroMessage(90, "Excellent");
    expect(m.toLowerCase()).toMatch(/keep/);
  });
});