import { describe, expect, it } from "vitest";

import { cellsLine, movement, movementLabel, percent, teachersBySubject, termsReleasedLine } from "./results";

describe("results wording", () => {
  it("writes averages as percentages and a missing one as a dash", () => {
    expect(percent("53.25")).toBe("53.3%");
    expect(percent(null)).toBe("-");
  });

  it("lists component marks with what they are out of", () => {
    expect(cellsLine({
      name: "Maths", teacher: null, total: 49, obtainable: 100, percentage: "49.00", grade: "D", remark: "Fair",
      cells: [{ short_name: "CA1", max_score: 20, mark: 9 }, { short_name: "EXAM", max_score: 60, mark: null }],
    })).toBe("CA1 9/20 · EXAM -/60");
  });

  it("compares the last two terms with figures", () => {
    expect(movement([{ percentage: "58" }, { percentage: "61" }, { percentage: "63" }])).toEqual({ direction: "up", points: 2 });
    expect(movement([{ percentage: "74" }, { percentage: "70" }])).toEqual({ direction: "down", points: 4 });
    expect(movement([{ percentage: "49" }, { percentage: "49" }])).toEqual({ direction: "same", points: 0 });
    expect(movement([{ percentage: "49" }])).toBeNull();
    expect(movementLabel({ direction: "down", points: 4 })).toBe("▼ 4 vs last term");
    expect(movementLabel({ direction: "same", points: 0 })).toBe("Held steady");
  });

  it("borrows each subject's teacher from the latest term", () => {
    const map = teachersBySubject([
      { name: "Maths", teacher: "Mr. Eze", cells: [], total: 1, obtainable: 1, percentage: "1", grade: "A", remark: null },
      { name: "English", teacher: null, cells: [], total: 1, obtainable: 1, percentage: "1", grade: "A", remark: null },
    ]);
    expect(map.get("Maths")).toBe("Mr. Eze");
    expect(map.has("English")).toBe(false);
  });

  it("says how many of the year's terms are released", () => {
    expect(termsReleasedLine({ terms_released: 3, terms_total: 3 })).toBe("3 of 3");
    expect(termsReleasedLine({ terms_released: 1 })).toBe("1 term");
  });
});
