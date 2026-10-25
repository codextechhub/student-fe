import { describe, expect, it } from "vitest";

import { cardPaymentsOn, isCardPaymentsOff } from "./card-payments";

describe("the school's card setting", () => {
  it("is off only when the answer says so", () => {
    expect(cardPaymentsOn({ card_payments: false })).toBe(false);
    expect(cardPaymentsOn({ card_payments: true })).toBe(true);
    expect(cardPaymentsOn({})).toBe(true);
  });

  it("recognises the refusal of a card checkout by its status and code together", () => {
    expect(isCardPaymentsOff({ status: 409, data: { error: { code: "CARD_PAYMENTS_OFF" } } })).toBe(true);
    expect(isCardPaymentsOff({ status: 409, data: { error: { code: "INVOICE_NOT_PAYABLE" } } })).toBe(false);
    expect(isCardPaymentsOff({ status: 403, data: { error: { code: "STUDENT_PAYMENT_OFF" } } })).toBe(false);
    expect(isCardPaymentsOff({ status: "FETCH_ERROR" })).toBe(false);
    expect(isCardPaymentsOff(null)).toBe(false);
  });
});
