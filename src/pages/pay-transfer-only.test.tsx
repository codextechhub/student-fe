/**
 * The Pay screen at a school that takes no card payments, and the moment a
 * screen opened before the school turned card off meets the refusal, for
 * Amaka, who owes ₦11,687.50 on her First Term bill.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cardPayments: false as boolean,
  fees: null as unknown as Record<string, unknown>,
  start: vi.fn(),
  dispatch: vi.fn(),
  account: { state: "ISSUED", bank_name: "Wema Bank", account_number: "0123456789", account_name: "AMAKA BALOGUN", as_of: "2026-10-25T09:00:00Z" } as Record<string, unknown>,
  deposits: [] as unknown[],
}));

vi.mock("@/native/platform", () => ({ isNativeApp: () => false }));
vi.mock("@/native/checkout", () => ({ openCheckout: vi.fn() }));
vi.mock("@/redux/hooks", () => ({
  useAppSelector: (pick: (s: unknown) => unknown) => pick({ connectivity: { offline: false }, session: { active: "amaka", pupils: [{ account: "amaka", fullName: "Amaka Balogun" }] } }),
  useAppDispatch: () => mocks.dispatch,
}));
vi.mock("@/redux/services/portal-api", () => ({
  refusal: (e: { data?: { message?: string } }) => ({ message: e?.data?.message ?? "Refused." }),
  useFeesQuery: () => ({ isLoading: false, data: mocks.fees }),
  useStartPaymentMutation: () => [mocks.start, { isLoading: false }],
  useTransferAccountQuery: () => ({ data: mocks.account, isLoading: false, isFetching: false, isError: false }),
  useMeQuery: () => ({ data: { student: { full_name: "Amaka Balogun" } } }),
  useOpenTransferAccountMutation: () => [vi.fn(), { isLoading: false }],
  useDepositsQuery: () => ({ data: { as_of: "x", deposits: mocks.deposits }, refetch: vi.fn() }),
}));

import { PayPage } from "./pay";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const fees = (over: Record<string, unknown>) => ({
  balance: 1_168_750, owing: 1_168_750, credit: 0, total_billed: 1_868_750, total_paid: 700_000, can_pay: true, min_part_payment: 100_000,
  invoices: [{ invoice_ref: 251, number: "IV-1", title: "First Term", invoice_date: null, due_date: null, lines: [], total: 1_868_750, paid: 700_000, balance: 1_168_750, status: "PARTIAL", status_label: "Part-paid" }],
  ...over,
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.fees = fees({ card_payments: false });
  mocks.start.mockReset();
  mocks.dispatch.mockReset();
  mocks.deposits = [];
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = () =>
  act(() => root.render(
    <MemoryRouter initialEntries={["/fees/pay/251"]}>
      <Routes><Route path="/fees/pay/:invoiceRef" element={<PayPage />} /></Routes>
    </MemoryRouter>,
  ));

describe("paying at a school that takes no card payments", () => {
  it("shows the transfer view only: the account number, with no card, no method choice, no minimum", () => {
    render();
    const text = container.textContent ?? "";
    expect(text).toContain("First Term");
    expect(text).toContain("Pay by bank transfer");
    expect(text).toContain("0123456789");
    expect(text).toContain("Wema Bank");
    expect(container.querySelector("[role=radio]")).toBeNull();
    expect(text).not.toContain("Continue to secure payment");
    expect(text).not.toContain("part payment");
    expect(text).not.toContain("card-payment minimum");
    expect(container.querySelector(".pay-card-off")).toBeNull();
  });

  it("shows a transfer on its way and then received, with the receipt", () => {
    mocks.deposits = [{ reference: "T1", amount: 1_168_750, status: "CONFIRMED", status_label: "Received", received_at: "x", payment_ref: 78, has_receipt: true }];
    render();
    expect(container.querySelector(".transfer-activity")?.textContent).toContain("Received: ₦11,687.50");
    expect(container.querySelector(".transfer-activity a")?.getAttribute("href")).toBe("/fees/receipts/78");
  });

  it("still says first that the school does not let pupils pay", () => {
    mocks.fees = fees({ card_payments: false, can_pay: false });
    render();
    expect(container.textContent).toContain("Your school doesn't take payments from pupils here");
    expect(container.textContent).not.toContain("0123456789");
  });
});

describe("a screen opened before the school turned card off", () => {
  const refuse = () => mocks.start.mockReturnValue({
    unwrap: async () => { throw { status: 409, data: { message: "Your school takes fee payments by bank transfer.", error: { code: "CARD_PAYMENTS_OFF", detail: {} } } }; },
  });
  const pickCard = async () => {
    mocks.fees = fees({ card_payments: true });
    render();
    await act(async () => { [...container.querySelectorAll<HTMLElement>("[role=radio]")].find((b) => b.textContent?.includes("Card"))!.click(); });
    await act(async () => { [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Continue to secure payment"))!.click(); });
  };

  it("reads the fees again and shows the transfer view with a plain line, not an error", async () => {
    refuse();
    await pickCard();
    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[role=alert]")).toBeNull();
    expect(container.querySelector(".pay-card-off")?.textContent).toBe("Your school takes fee payments by bank transfer. Pay into the account number below.");
    expect(container.textContent).toContain("0123456789");
    expect(container.querySelector("[role=radio]")).toBeNull();
    expect(container.textContent).not.toContain("Continue to secure payment");
  });

  it("keeps showing other refusals as errors on the card form", async () => {
    mocks.start.mockReturnValue({ unwrap: async () => { throw { status: 409, data: { message: "This invoice is already paid.", error: { code: "INVOICE_NOT_PAYABLE" } } }; } });
    await pickCard();
    expect(container.querySelector("[role=alert]")?.textContent).toBe("This invoice is already paid.");
    expect(container.querySelector(".pay-card-off")).toBeNull();
  });
});

describe("paying at a school that takes card payments", () => {
  it("offers the card and the transfer, as before", () => {
    mocks.fees = fees({ card_payments: true });
    render();
    expect(container.querySelectorAll("[role=radio]").length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).toContain("Continue to secure payment");
  });
});
