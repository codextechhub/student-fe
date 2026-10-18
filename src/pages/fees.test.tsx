import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  account: { state: "ISSUED", bank_name: "Wema Bank", account_number: "0123456789", account_name: "TEST-MANAGED-ACCOUNT", as_of: "2026-10-18T00:00:00Z" } as
    | { state: "ISSUED"; bank_name: string; account_number: string; account_name: string; as_of: string }
    | { state: "NONE"; as_of: string },
  invoices: [] as unknown[],
}));

vi.mock("@/redux/hooks", () => ({
  useAppSelector: (pick: (s: unknown) => unknown) => pick({
    connectivity: { offline: false },
    session: { active: "amaka", pupils: [{ account: "amaka", fullName: "Amaka Balogun" }] },
  }),
}));
vi.mock("@/redux/services/portal-api", () => ({
  useFeesQuery: () => ({ data: { balance: 0, total_billed: 100_000, total_paid: 100_000, can_pay: true, min_part_payment: 0, invoices: mocks.invoices } }),
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
});
