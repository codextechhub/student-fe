import { describe, expect, it } from "vitest";

import { noticeActionLabel, noticeHeadline, noticePath } from "./payment-notices";

describe("noticePath", () => {
  it("opens the receipt the notice names, without the app prefix", () => {
    expect(noticePath("/student/fees/receipts/42")).toBe("/fees/receipts/42");
    expect(noticePath("/student/fees/receipts/42/")).toBe("/fees/receipts/42");
  });

  it("opens Fees when the address is missing or not a receipt in this app", () => {
    expect(noticePath(undefined)).toBe("/fees");
    expect(noticePath("")).toBe("/fees");
    expect(noticePath("/finance")).toBe("/fees");
    expect(noticePath("/parent/fees/receipts/42")).toBe("/fees");
    expect(noticePath("/student/fees/receipts/abc")).toBe("/fees");
    expect(noticePath("https://elsewhere.example/student/fees/receipts/42")).toBe("/fees");
  });
});

describe("noticeHeadline", () => {
  it("leads with the amount the school's subject starts with", () => {
    expect(noticeHeadline("₦500.00 received from Tunde Bello")).toBe("₦500.00");
    expect(noticeHeadline("₦12,500.50 received from Tunde Bello")).toBe("₦12,500.50");
  });

  it("shows a subject without a leading amount whole, and names an empty one", () => {
    expect(noticeHeadline("Payment confirmed")).toBe("Payment confirmed");
    expect(noticeHeadline("")).toBe("Payment received");
  });
});

describe("noticeActionLabel", () => {
  it("says View receipt for a receipt address and View fees for anything else", () => {
    expect(noticeActionLabel("/student/fees/receipts/42")).toBe("View receipt");
    expect(noticeActionLabel("")).toBe("View fees");
    expect(noticeActionLabel("/parent/fees/receipts/42")).toBe("View fees");
  });
});
