import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  account: { state: "ISSUED", bank_name: "Wema Bank", account_number: "0123456789", account_name: "TEST-MANAGED-ACCOUNT", as_of: "2026-10-18T00:00:00Z" } as
    | { state: "ISSUED"; bank_name: string; account_number: string; account_name: string; as_of: string }
    | { state: "NONE"; as_of: string },
  invoices: [] as unknown[],
  balance: 0,
  canPay: true,
}));

vi.mock("@/redux/hooks", () => ({
  useAppSelector: (pick: (s: unknown) => unknown) => pick({
    connectivity: { offline: false },
    session: { active: "amaka", pupils: [{ account: "amaka", fullName: "Amaka Balogun" }] },
  }),
}));
vi.mock("@/redux/services/portal-api", () => ({
  useFeesQuery: () => ({ data: { balance: mocks.balance, total_billed: 100_000, total_paid: 100_000, can_pay: mocks.canPay, min_part_payment: 0, invoices: mocks.invoices } }),
  usePaymentsQuery: () => ({ data: [] }),
  useTransferAccountQuery: () => ({ data: mocks.account }),
  useMeQuery: () => ({ data: { student: { full_name: "Amaka Balogun" } } }),
}));

import { FeesPage } from "./fees";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.account = { state: "ISSUED", bank_name: "Wema Bank", account_number: "0123456789", account_name: "TEST-MANAGED-ACCOUNT", as_of: "2026-10-18T00:00:00Z" };
  mocks.invoices = [];
  mocks.balance = 0;
  mocks.canPay = true;
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const render = () => act(() => root.render(<MemoryRouter><FeesPage /></MemoryRouter>));

describe("fees account number", () => {
  it("shows the pupil's number and name after both bills are fully paid", () => {
    mocks.invoices = [
      { invoice_ref: 1, number: "IV-1", title: "First Term", due_date: null, lines: [], total: 50_000, paid: 50_000, balance: 0, status: "PAID", status_label: "Paid" },
      { invoice_ref: 2, number: "IV-2", title: "Second Term", due_date: null, lines: [], total: 50_000, paid: 50_000, balance: 0, status: "PAID", status_label: "Paid" },
    ];
    render();
    expect(container.textContent).toContain("Your account number");
    expect(container.textContent).toContain("Amaka Balogun's account");
    expect(container.textContent).toContain("0123456789");
    expect(container.textContent).toContain("Bank account name: TEST-MANAGED-ACCOUNT");
    expect(container.textContent).toContain("First Term");
    expect(container.textContent).toContain("Second Term");
    expect(container.textContent).not.toContain("Pay balance");
  });

  it("does not show an account number until one has been issued", () => {
    mocks.account = { state: "NONE", as_of: "2026-10-18T00:00:00Z" };
    render();
    expect(container.textContent).not.toContain("Your account number");
  });

  it("labels a credit balance even when there are no open bills", () => {
    mocks.balance = -300_000;
    render();
    expect(container.querySelector(".fees-hero-label")?.textContent).toBe("In credit");
    expect(container.querySelector(".fees-hero-main")?.textContent).toContain("₦3,000.00");
  });

  it("does not offer payment when the school has turned it off", () => {
    mocks.canPay = false;
    mocks.balance = 50_000;
    mocks.invoices = [{ invoice_ref: 3, number: "IV-3", title: "Third Term", due_date: null, lines: [], total: 100_000, paid: 50_000, balance: 50_000, status: "PARTIAL", status_label: "Part paid" }];
    render();
    expect(container.textContent).toContain("Third Term");
    expect(container.textContent).not.toContain("Pay balance");
  });

  it("filters bills by year and balance without changing the account total", () => {
    mocks.invoices = [
      { invoice_ref: 1, number: "IV-1", title: "Old paid bill", invoice_date: "2024-09-01", due_date: null, lines: [], total: 50_000, paid: 50_000, balance: 0, status: "PAID", status_label: "Paid" },
      { invoice_ref: 2, number: "IV-2", title: "Current unpaid bill", invoice_date: "2026-09-01", due_date: null, lines: [], total: 50_000, paid: 0, balance: 50_000, status: "DUE", status_label: "Due" },
    ];
    render();
    const [year, status] = container.querySelectorAll<HTMLSelectElement>(".fees-filters select");
    act(() => { year.value = "2024"; year.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(container.querySelector(".fees-invoices")?.textContent).toContain("Old paid bill");
    expect(container.querySelector(".fees-invoices")?.textContent).not.toContain("Current unpaid bill");
    act(() => { status.value = "due"; status.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(container.textContent).toContain("No bills match these filters.");
    expect(container.querySelector(".fees-stats")?.textContent).toContain("₦1,000.00");
  });
});
