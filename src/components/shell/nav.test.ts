import { Home } from "lucide-react";
import { describe, expect, it } from "vitest";

import { itemFor, splitTabs, type NavItem } from "./nav";

const make = (n: number): NavItem[] =>
  Array.from({ length: n }, (_, i) => ({ key: "home", label: `S${i}`, path: `/s${i}`, icon: Home }));

describe("the phone's tab bar", () => {
  it("shows up to five destinations as tabs", () => {
    expect(splitTabs(make(5))).toEqual({ tabs: make(5), more: [] });
  });

  it("keeps four tabs and puts the rest under More when there are more than five", () => {
    const { tabs, more } = splitTabs(make(7));
    expect(tabs.map((t) => t.label)).toEqual(["S0", "S1", "S2", "S3"]);
    expect(more.map((t) => t.label)).toEqual(["S4", "S5", "S6"]);
  });

  it("names the screen a notice belongs to", () => {
    expect(itemFor("/notices/12")?.key).toBe("notices");
    expect(itemFor("/")?.key).toBe("home");
    expect(itemFor("/profile")?.key).toBe("profile");
  });
});
