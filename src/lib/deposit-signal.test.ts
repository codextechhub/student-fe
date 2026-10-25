import { describe, expect, it, vi } from "vitest";

import { isPaymentPush, onDepositCheck, requestDepositCheck } from "./deposit-signal";

describe("the nudge to look for a transfer", () => {
  it("reaches every watching screen until it stops listening", () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = onDepositCheck(first);
    const stopSecond = onDepositCheck(second);
    requestDepositCheck();
    stopFirst();
    requestDepositCheck();
    stopSecond();
    requestDepositCheck();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });
});

describe("which pushes are Payment received", () => {
  it("is the payment kind, or a receipt address", () => {
    expect(isPaymentPush({ tag: "billing.payment_received" })).toBe(true);
    expect(isPaymentPush({ url: "/student/fees/receipts/9" })).toBe(true);
    expect(isPaymentPush({ tag: "notices.published", url: "/student/notices" })).toBe(false);
    expect(isPaymentPush({ url: "/student/fees/receipts/abc" })).toBe(false);
    expect(isPaymentPush(null)).toBe(false);
  });
});
