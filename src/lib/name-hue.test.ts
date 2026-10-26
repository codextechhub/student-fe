import { describe, expect, it } from "vitest";

import { hueFor, toneFor } from "./name-hue";

describe("a name's colour", () => {
  it("is the same every time, whatever the spacing or case", () => {
    expect(hueFor("Mr. Okafor")).toBe(hueFor("  mr. okafor "));
    expect(toneFor("Mr. Okafor")).toEqual(toneFor("Mr. Okafor"));
  });

  it("spreads different names across the hues", () => {
    const names = ["Mr. Okafor", "Mrs. Bello", "Dr. Nwosu", "School office", "Ms. Eze", "Mme. Diallo"];
    expect(new Set(names.map(hueFor)).size).toBeGreaterThan(2);
  });
});
