import { describe, expect, it } from "vitest";

import type { Conversation } from "@/redux/services/messages-api";
import type { Notice } from "@/redux/services/portal-api";

import { inboxShow, mergeInbox } from "./inbox";

const notice = (id: number, at: string): Notice => ({
  id, title: `Notice ${id}`, body: "", audience_label: "All pupils", published_at: at, edited_at: null, unread: false,
});
const conversation = (id: number, at: string | null, activity = "2026-10-01T08:00:00Z"): Conversation => ({
  id, kind: "DIRECT", kind_label: "", display_name: `Teacher ${id}`, counterpart: null,
  last_message: at ? { id, preview: "", sender_name: "", sent_at: at, mine: false } : null,
  last_activity_at: activity, unread_count: 0, read_only: false, can_send: true, read_only_reason: "",
});
const ids = (entries: ReturnType<typeof mergeInbox>["entries"]) =>
  entries.map((e) => (e.kind === "notice" ? `n${e.notice.id}` : `m${e.conversation.id}`));

describe("the Inbox list", () => {
  it("puts notices and conversations together, newest first", () => {
    const { entries, more } = mergeInbox(
      { rows: [notice(1, "2026-10-24T09:00:00Z"), notice(2, "2026-10-20T09:00:00Z")], more: false },
      { rows: [conversation(7, "2026-10-26T09:12:00Z"), conversation(8, "2026-10-22T09:00:00Z")], more: false },
    );
    expect(ids(entries)).toEqual(["m7", "n1", "m8", "n2"]);
    expect(more).toBe(false);
  });

  it("dates a conversation with no messages by its last activity", () => {
    const { entries } = mergeInbox(
      { rows: [notice(1, "2026-10-24T09:00:00Z")], more: false },
      { rows: [conversation(7, null, "2026-10-25T09:00:00Z")], more: false },
    );
    expect(ids(entries)).toEqual(["m7", "n1"]);
  });

  it("holds back what is older than an unread page could be, and offers older", () => {
    const { entries, more } = mergeInbox(
      { rows: [notice(1, "2026-10-24T09:00:00Z"), notice(2, "2026-10-20T09:00:00Z")], more: true },
      { rows: [conversation(7, "2026-10-26T09:00:00Z"), conversation(8, "2026-10-10T09:00:00Z")], more: false },
    );
    // Notices' next page may hold one from 15 October, newer than conversation 8.
    expect(ids(entries)).toEqual(["m7", "n1", "n2"]);
    expect(more).toBe(true);
  });

  it("shows one source on its own when the other is filtered out", () => {
    const { entries, more } = mergeInbox(null, { rows: [conversation(7, "2026-10-26T09:00:00Z")], more: true });
    expect(ids(entries)).toEqual(["m7"]);
    expect(more).toBe(true);
  });
});

describe("the Inbox filter", () => {
  it("reads notices or messages from the address, and anything else as everything", () => {
    expect(inboxShow("notices")).toBe("notices");
    expect(inboxShow("messages")).toBe("messages");
    expect(inboxShow(null)).toBe("all");
    expect(inboxShow("spam")).toBe("all");
  });
});
