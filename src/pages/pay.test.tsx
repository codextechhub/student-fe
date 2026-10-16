/**
 * Paying a bill by card, for Ebere, who owes ₦11,687.50 at a school whose
 * smallest part payment is ₦1,000.00.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canPay: true,
  start: vi.fn(),
  offline: false,
}));

vi.mock("@/redux/hooks", () => ({
  useAppSelector: (pick: (s: unknown) => unknown) => pick({ connectivity: { offline: mocks.offline } }),
  useAppDispatch: () => vi.fn(),
}));
vi.mock("@/redux/services/portal-api", () => ({
  refusal: (e: { data?: { message?: string } }) => ({ message: e?.data?.message ?? "Refused." }),
  useFeesQuery: () => ({
    isLoading: false,
    data: {
      balance: 1_168_750, total_billed: 1_868_750, total_paid: 700_000, can_pay: mocks.canPay, min_part_payment: 100_000,
      invoices: [{ invoice_ref: 251, number: "IV-1", title: "First Term", invoice_date: null, due_date: null, lines: [], total: 1_868_750, paid: 700_000, balance: 1_168_750, status: "PARTIAL", status_label: "Part-paid" }],
    },
  }),
  useStartPaymentMutation: () => [mocks.start, { isLoading: false }],
  useTransferAccountQuery: () => ({ isLoading: true }),
  useOpenTransferAccountMutation: () => [vi.fn(), { isLoading: false }],
  useDepositsQuery: () => ({ data: undefined }),
}));

import { PayPage } from "./pay";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  mocks.canPay = true;
  mocks.offline = false;
  mocks.start.mockReset().mockReturnValue({ unwrap: async () => ({ checkout_url: "https://checkout.example/abc", reference: "R", amount: 1, balance_after: 0 }) });
  vi.stubGlobal("location", { ...window.location, assign: vi.fn() });
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

const render = () =>
  act(() => root.render(
    <MemoryRouter initialEntries={["/fees/pay/251"]}>
      <Routes><Route path="/fees/pay/:invoiceRef" element={<PayPage />} /></Routes>
    </MemoryRouter>,
  ));
const choose = (label: string) =>
  act(() => { [...container.querySelectorAll<HTMLElement>("[role=radio]")].find((b) => b.textContent?.includes(label))!.click(); });
const type = (value: string) => act(() => {
  const input = container.querySelector<HTMLInputElement>("input")!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
const go = async () => {
  await act(async () => { [...container.querySelectorAll("button")].find((b) => b.textContent?.includes("Continue to secure payment"))!.click(); });
};

describe("paying a bill by card", () => {
  it("refuses a part payment below the school's minimum without asking the gateway", async () => {
    render();
    choose("Card");
    choose("Part payment");
    type("500");
    await go();
    expect(container.querySelector("[role=alert]")?.textContent).toBe("The smallest part payment your school accepts is ₦1,000.00.");
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("refuses more than the balance", async () => {
    render();
    choose("Card");
    choose("Part payment");
    type("20,000");
    await go();
    expect(container.querySelector("[role=alert]")?.textContent).toContain("at most the balance, ₦11,687.50");
  });

  it("pays the whole balance in kobo and goes to the gateway's page", async () => {
    render();
    choose("Card");
    await go();
    expect(mocks.start).toHaveBeenCalledWith({ invoiceRef: 251, amount: 1_168_750 });
    expect(window.location.assign).toHaveBeenCalledWith("https://checkout.example/abc");
  });

  it("shows the server's refusal word for word", async () => {
    mocks.start.mockReturnValue({ unwrap: async () => { throw { data: { message: "This invoice is already paid." } }; } });
    render();
    choose("Card");
    await go();
    expect(container.querySelector("[role=alert]")?.textContent).toBe("This invoice is already paid.");
  });

  it("offers no way to pay at a school that does not take pupils' payments", () => {
    mocks.canPay = false;
    render();
    expect(container.textContent).toContain("Your school doesn't take payments from pupils here");
    expect(container.querySelector("[role=radio]")).toBeNull();
  });

  it("offers no way to pay offline", () => {
    mocks.offline = true;
    render();
    expect(container.textContent).toContain("You're offline");
    expect(container.querySelector("[role=radio]")).toBeNull();
  });
});
