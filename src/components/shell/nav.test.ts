import { Home } from "lucide-react";
import { describe, expect, it } from "vitest";

import { isConversationPath, itemFor, NAV, splitTabs, type NavItem } from "./nav";

const item = (label: string, onBar = false): NavItem => ({ key: "home", label, path: `/${label}`, icon: Home, onBar });

describe("the tab bar", () => {
  it("shows every screen as a tab while there are five or fewer", () => {
    const five = ["Home", "Timetable", "Attendance", "Notices", "Profile"].map((l) => item(l));
    expect(splitTabs(five)).toEqual({ tabs: five, more: [] });
  });

  it("keeps the chosen four and puts the rest under More once there are more than five", () => {
    const all = [
      item("Home", true), item("Timetable", true), item("Results", true), item("Attendance"),
      item("Notices"), item("Fees", true), item("Profile"),
    ];
    const { tabs, more } = splitTabs(all);
    expect(tabs.map((t) => t.label)).toEqual(["Home", "Timetable", "Results", "Fees"]);
    expect(more.map((t) => t.label)).toEqual(["Attendance", "Notices", "Profile"]);
  });

  it("keeps Messages under More, beside Notices, so the bar keeps the four most used", () => {
    const { tabs, more } = splitTabs(NAV);
    expect(tabs.map((t) => t.key)).toEqual(["home", "timetable", "results", "fees"]);
    expect(more.map((t) => t.key)).toContain("messages");
  });

  it("names the screen a path belongs to", () => {
    expect(itemFor("/messages/41")?.key).toBe("messages");
    expect(itemFor("/messages/new")?.key).toBe("messages");
    expect(itemFor("/notices/12")?.key).toBe("notices");
    expect(itemFor("/")?.key).toBe("home");
    expect(itemFor("/timetable")?.key).toBe("timetable");
  });
});

describe("an open conversation", () => {
  it("is a conversation id under Messages, and nothing else", () => {
    expect(isConversationPath("/messages/41")).toBe(true);
    expect(isConversationPath("/messages/41/")).toBe(true);
    expect(isConversationPath("/messages")).toBe(false);
    expect(isConversationPath("/messages/new")).toBe(false);
    expect(isConversationPath("/notices/41")).toBe(false);
  });
});
