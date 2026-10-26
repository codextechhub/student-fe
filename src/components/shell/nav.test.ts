import { describe, expect, it } from "vitest";

import { INBOX, isConversationPath, itemFor, TABS } from "./nav";

describe("the tab bar", () => {
  it("holds Home, Timetable, Results and Fees, in that order", () => {
    expect(TABS.map((t) => t.key)).toEqual(["home", "timetable", "results", "fees"]);
  });

  it("puts Notices and Messages behind the Inbox button", () => {
    expect(INBOX.map((t) => t.key)).toEqual(["notices", "messages"]);
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
