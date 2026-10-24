import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ receipt: {} as Record<string, unknown> }));
vi.mock("@/components/layout/page-shell", () => ({
  PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/redux/services/portal-api", () => ({
  useReceiptQuery: () => ({ data: mocks.receipt, isLoading: false, isError: false }),
  useLazyReceiptPdfQuery: () => [vi.fn(), { isFetching: false }],
}));

import { ReceiptPage } from "./receipt";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

function receipt(balanceAfter: number) {
  return {
    payment_ref: 41,
    receipt_number: "BSS-RCP-2026-00041",
    paid_on: "2026-10-16",
    amount: 10_000_000,
    method: "CARD",
    method_label: "Card",
    reference: "R1",
    payer_name: "",
    received_from: "Tunde Bello",
    lines: [{ invoice_number: "BSS-INV-2026-00001", title: "First Term", amount_applied: 10_000_000, balance_after: 0 }],
    balance_after: balanceAfter,
    issuer_name: "Bright Star School",
  };
}

function balanceRow(balanceAfter: number): string {
  mocks.receipt = receipt(balanceAfter);
  act(() => root.render(
    <MemoryRouter initialEntries={["/fees/receipts/41"]}>
      <Routes><Route path="/fees/receipts/:paymentRef" element={<ReceiptPage />} /></Routes>
    </MemoryRouter>,
  ));
  return container.querySelector(".receipt-balance")?.textContent ?? "";
}

describe("receipt balance", () => {
  it("says the account is still owing", () => {
    expect(balanceRow(10_000_000)).toBe("Account balance after this payment₦100,000.00 owing");
  });

  it("says the account is in credit, with no minus sign", () => {
    expect(balanceRow(-2_000_000)).toBe("Account balance after this payment₦20,000.00 in credit");
  });

  it("says nothing is owing when the balance is zero", () => {
    expect(balanceRow(0)).toBe("Account balance after this payment₦0.00");
  });
});
