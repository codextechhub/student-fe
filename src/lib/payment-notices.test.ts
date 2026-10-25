import { describe, expect, it } from "vitest";

import { describeNotice } from "./payment-notices";

const notice = {
  subject: "₦500.00 received from Tunde Bello",
  body: "Receipt RCP-0007, 25 Oct 2026, applied to INV-0012.",
};

describe("describeNotice", () => {
  it("names the amount and the receipt it opens", () => {
    const line = describeNotice(notice, [{ payment_ref: 42, receipt_number: "RCP-0007" }]);
    expect(line.title).toBe("Payment received, ₦500.00");
    expect(line.receiptNumber).toBe("RCP-0007");
    expect(line.href).toBe("/fees/receipts/42");
  });

  it("opens Fees while the receipt is not among the payments yet", () => {
    expect(describeNotice(notice, undefined).href).toBe("/fees");
    expect(describeNotice(notice, [{ payment_ref: 9, receipt_number: "RCP-0001" }]).href).toBe("/fees");
  });

  it("keeps the school's own subject when it does not read as a payment", () => {
    const line = describeNotice({ subject: "Payment confirmed", body: "" }, []);
    expect(line.title).toBe("Payment confirmed");
    expect(line.receiptNumber).toBe("");
  });
});
