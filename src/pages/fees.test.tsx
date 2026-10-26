import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  account: { state: "ISSUED", bank_name: "Wema Bank", account_number: "0123456789", account_name: "TEST-MANAGED-ACCOUNT", as_of: "2026-10-18T00:00:00Z" } as
    | { state: "ISSUED"; bank_name: string; account_number: string; account_name: string; as_of: string }
    | { state: "NONE"; as_of: string },
  invoices: [] as unknown[],
  charges: undefined as unknown[] | undefined,
  orderedItems: null as unknown[] | null,
  payments: [] as unknown[],
  billPageSize: 8,
  balance: 0,
  owing: 0,
  credit: 0,
  canPay: true,
}));

vi.mock("@/redux/hooks", () => ({
  useAppSelector: (pick: (s: unknown) => unknown) => pick({
    connectivity: { offline: false },
    session: { active: "amaka", pupils: [{ account: "amaka", fullName: "Amaka Balogun" }] },
  }),
}));
vi.mock("@/redux/services/portal-api", () => ({
  useFeeBillsQuery: ({ page, year, status }: { page: number; year: string; status: string }) => {
    const items = (mocks.orderedItems ?? [
      ...(mocks.charges ?? []).map((charge) => ({ kind: "charge", ...(charge as object) })),
      ...mocks.invoices.map((invoice) => ({ kind: "invoice", ...(invoice as object) })),
    ]) as { kind: string; balance: number; invoice_date?: string; due_date?: string; date?: string }[];
    const filtered = items.filter((item) =>
      (year === "all" || (item.kind === "invoice" ? item.invoice_date ?? item.due_date : item.date)?.startsWith(year)) &&
      (status === "all" || (item.balance > 0) === (status === "due")),
    );
    const result = {
      balance: mocks.balance, owing: mocks.owing, credit: mocks.credit, total_billed: 100_000, total_paid: 100_000, can_pay: mocks.canPay, min_part_payment: 0,
      has_bills: items.length > 0, years: ["2026", "2024"], next_due: null,
      items: filtered.slice((page - 1) * mocks.billPageSize, page * mocks.billPageSize),
      pagination: { page, page_size: mocks.billPageSize, total: filtered.length, total_pages: Math.max(1, Math.ceil(filtered.length / mocks.billPageSize)) },
    };
    return { data: result, currentData: result, refetch: vi.fn() };
  },
  usePaymentPageQuery: ({ page, year }: { page: number; year: string }) => {
    const filtered = (mocks.payments as { paid_on: string | null }[]).filter((payment) => year === "all" || payment.paid_on?.startsWith(year));
    const result = { items: filtered.slice((page - 1) * 10, page * 10), years: ["2026", "2024"], pagination: { page, page_size: 10, total: filtered.length, total_pages: Math.max(1, Math.ceil(filtered.length / 10)) } };
    return { data: result, currentData: result, refetch: vi.fn() };
  },
  useTransferAccountQuery: () => ({ data: mocks.account }),
  useMeQuery: () => ({ data: { student: { full_name: "Amaka Balogun" } } }),
  useOpenTransferAccountMutation: () => [vi.fn(), { isLoading: false }],
  refusal: () => ({ message: "" }),
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
  mocks.charges = undefined;
  mocks.orderedItems = null;
  mocks.payments = [];
  mocks.billPageSize = 8;
  mocks.balance = 0;
  mocks.owing = 0;
  mocks.credit = 0;
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
    act(() => (container.querySelector('button[aria-controls="fees-transfer-account"]') as HTMLButtonElement).click());
    expect(container.textContent).toContain("Your account number");
    expect(container.textContent).toContain("Amaka Balogun's account");
    expect(container.textContent).toContain("0123456789");
    expect(container.textContent).toContain("Bank account name: TEST-MANAGED-ACCOUNT");
    expect(container.textContent).toContain("First Term");
    expect(container.textContent).toContain("Second Term");
    expect(container.textContent).not.toContain("Pay bill");
  });

  it("does not show an account number until one has been issued", () => {
    mocks.account = { state: "NONE", as_of: "2026-10-18T00:00:00Z" };
    render();
    expect(container.textContent).not.toContain("Your account number");
  });

  it("labels a credit balance even when there are no open bills", () => {
    mocks.balance = -300_000;
    mocks.credit = 300_000;
    render();
    expect(container.querySelector(".fees-hero-label")?.textContent).toBe("In credit");
    expect(container.querySelector(".fees-hero-value")?.textContent).toContain("₦3,000.00");
  });

  it("shows what is owed, not the net, when an unpaid bill and larger credit coexist", () => {
    mocks.balance = -50_000;
    mocks.owing = 150_000;
    mocks.credit = 200_000;
    mocks.invoices = [{ invoice_ref: 5, number: "IV-5", title: "First Term", due_date: null, lines: [], total: 150_000, paid: 0, balance: 150_000, status: "DUE", status_label: "Due" }];
    render();
    expect(container.querySelector(".fees-hero-label")?.textContent).toBe("Balance to pay");
    expect(container.querySelector(".fees-hero-value")?.textContent).toContain("₦1,500.00");
    expect(container.querySelector(".fees-hero-credit")?.textContent).toBe("₦2,000.00 credit held by the school. Ask the school to apply it before you pay.");
    expect(container.querySelector(".fees-hero")?.textContent).not.toContain("In credit");
    expect(container.querySelector(".fees-hero")?.textContent).not.toContain("All paid");
    expect(container.textContent).toContain("What you owe");
    expect(container.textContent).toContain("Pay bill");
  });

  it("shows the bill, not 'All paid', when credit exactly covers it", () => {
    mocks.balance = 0;
    mocks.owing = 150_000;
    mocks.credit = 150_000;
    mocks.invoices = [{ invoice_ref: 5, number: "IV-5", title: "First Term", due_date: null, lines: [], total: 150_000, paid: 0, balance: 150_000, status: "DUE", status_label: "Due" }];
    render();
    expect(container.querySelector(".fees-hero-label")?.textContent).toBe("Balance to pay");
    expect(container.querySelector(".fees-hero-value")?.textContent).toContain("₦1,500.00");
    expect(container.querySelector(".fees-hero")?.textContent).not.toContain("All paid");
  });

  it("shows no credit line when nothing is held", () => {
    mocks.balance = 50_000;
    mocks.owing = 50_000;
    mocks.invoices = [{ invoice_ref: 3, number: "IV-3", title: "Third Term", due_date: null, lines: [], total: 100_000, paid: 50_000, balance: 50_000, status: "PARTIAL", status_label: "Part paid" }];
    render();
    expect(container.querySelector(".fees-hero-credit")).toBeNull();
  });

  it("reads a copy saved before owing and credit were sent from the net balance", () => {
    mocks.balance = 50_000;
    mocks.owing = undefined as unknown as number;
    mocks.credit = undefined as unknown as number;
    mocks.invoices = [{ invoice_ref: 3, number: "IV-3", title: "Third Term", due_date: null, lines: [], total: 100_000, paid: 50_000, balance: 50_000, status: "PARTIAL", status_label: "Part paid" }];
    render();
    expect(container.querySelector(".fees-hero-label")?.textContent).toBe("Balance to pay");
    expect(container.querySelector(".fees-hero-value")?.textContent).toContain("₦500.00");
  });

  it("does not offer payment when the school has turned it off", () => {
    mocks.canPay = false;
    mocks.balance = 50_000;
    mocks.owing = 50_000;
    mocks.invoices = [{ invoice_ref: 3, number: "IV-3", title: "Third Term", due_date: null, lines: [], total: 100_000, paid: 50_000, balance: 50_000, status: "PARTIAL", status_label: "Part paid" }];
    render();
    expect(container.textContent).toContain("Third Term");
    expect(container.textContent).not.toContain("Pay bill");
  });

  it("filters bills by year and balance without changing the account total", () => {
    mocks.balance = 50_000;
    mocks.owing = 50_000;
    mocks.invoices = [
      { invoice_ref: 1, number: "IV-1", title: "Old paid bill", invoice_date: "2024-09-01", due_date: null, lines: [], total: 50_000, paid: 50_000, balance: 0, status: "PAID", status_label: "Paid" },
      { invoice_ref: 2, number: "IV-2", title: "Current unpaid bill", invoice_date: "2026-09-01", due_date: null, lines: [], total: 50_000, paid: 0, balance: 50_000, status: "DUE", status_label: "Due" },
    ];
    render();
    act(() => (container.querySelector('button[aria-label="Filter fees"]') as HTMLButtonElement).click());
    const [year, status] = document.querySelectorAll<HTMLSelectElement>(".fees-filter-popover select");
    act(() => { year.value = "2024"; year.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(container.querySelector(".fees-invoices")?.textContent).toContain("Old paid bill");
    expect(container.querySelector(".fees-invoices")?.textContent).not.toContain("Current unpaid bill");
    act(() => { status.value = "due"; status.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(container.textContent).toContain("No bills match these filters.");
    expect(container.querySelector(".fees-hero-value")?.textContent).toContain("₦500.00");
  });

  it("lists a charge added after the bill, so the balance it makes up can be found", () => {
    mocks.balance = 700_000;
    mocks.owing = 700_000;
    mocks.invoices = [{ invoice_ref: 1, number: "IV-1", title: "Second Semester", due_date: null, lines: [], total: 50_000, paid: 50_000, balance: 0, status: "PAID", status_label: "Paid" }];
    mocks.charges = [{ note_ref: 9, number: "DN-4", date: "2026-10-18", reason: "Science practical", total: 1_000_000, paid: 300_000, balance: 700_000, status: "PARTIAL", status_label: "Part paid" }];
    render();
    const bills = container.querySelector(".fees-invoices")!;
    expect(bills.textContent).toContain("Science practical");
    expect(bills.querySelector('[aria-controls="fees-charge-9"]')?.getAttribute("aria-expanded")).toBe("false");
    act(() => (bills.querySelector('[aria-controls="fees-charge-9"]') as HTMLButtonElement).click());
    expect(bills.textContent).toContain("DN-4");
    expect(bills.querySelector('[aria-controls="fees-charge-9"]')?.getAttribute("aria-expanded")).toBe("true");
    expect(bills.textContent).toContain("₦7,000.00");
    expect(bills.textContent).toContain("Pay this by bank transfer to your account number.");
    expect(container.querySelector(".fees-hero-label")?.textContent).toBe("Balance to pay");
  });

  it("renders the server's prioritized bill order", () => {
    mocks.invoices = [
      { invoice_ref: 1, number: "IV-1", title: "Old paid bill", invoice_date: "2024-09-01", due_date: null, lines: [], total: 50_000, paid: 50_000, balance: 0, status: "PAID", status_label: "Paid" },
      { invoice_ref: 2, number: "IV-2", title: "Later unpaid bill", invoice_date: "2026-09-01", due_date: "2026-11-01", lines: [], total: 50_000, paid: 0, balance: 50_000, status: "DUE", status_label: "Due" },
      { invoice_ref: 3, number: "IV-3", title: "New paid bill", invoice_date: "2026-01-01", due_date: null, lines: [], total: 50_000, paid: 50_000, balance: 0, status: "PAID", status_label: "Paid" },
      { invoice_ref: 4, number: "IV-4", title: "Earlier unpaid bill", invoice_date: "2026-08-01", due_date: "2026-10-01", lines: [], total: 50_000, paid: 0, balance: 50_000, status: "DUE", status_label: "Due" },
    ];
    mocks.charges = [{ note_ref: 9, number: "DN-9", date: "2026-09-20", reason: "Practical charge", total: 20_000, paid: 0, balance: 20_000, status: "UNPAID", status_label: "Owing" }];
    mocks.orderedItems = [
      { kind: "charge", ...(mocks.charges[0] as object) },
      ...[3, 1, 2, 0].map((index) => ({ kind: "invoice", ...(mocks.invoices[index] as object) })),
    ];

    render();

    expect([...container.querySelectorAll(".fees-bill-row .fees-invoice-title strong")].map((title) => title.textContent)).toEqual([
      "Practical charge", "Earlier unpaid bill", "Later unpaid bill", "New paid bill", "Old paid bill",
    ]);
    expect(container.querySelector(".fees-invoice-toggle")?.getAttribute("aria-expanded")).toBe("false");
  });

  it("changes bill pages without paging payment history", () => {
    mocks.billPageSize = 2;
    mocks.invoices = [1, 2, 3].map((invoice_ref) => ({ invoice_ref, number: `IV-${invoice_ref}`, title: `Bill ${invoice_ref}`, invoice_date: "2026-01-01", due_date: null, lines: [], total: 10_000, paid: 0, balance: 10_000, status: "DUE", status_label: "Due" }));
    mocks.payments = [{ reference: "P1", amount: 10_000, status: "CONFIRMED", status_label: "Confirmed", method_label: "Card", paid_on: "2026-01-01", payer_name: "", source_label: "", has_receipt: false, payment_ref: null }];
    render();
    expect(container.querySelector(".fees-invoices")?.textContent).toContain("Bill 1");
    expect(container.querySelector(".fees-invoices")?.textContent).not.toContain("Bill 3");
    expect(container.querySelector('nav[aria-label="School bills pages"]')?.textContent).toContain("1–2 of 3");

    act(() => (container.querySelector('button[aria-label="Next school bills page"]') as HTMLButtonElement).click());

    expect(container.querySelector(".fees-invoices")?.textContent).toContain("Bill 3");
    expect(container.querySelector(".fees-invoices")?.textContent).not.toContain("Bill 1");
    act(() => (container.querySelector('button[aria-controls="fees-payment-history"]') as HTMLButtonElement).click());
    expect(container.querySelector(".fees-history")?.textContent).toContain("₦100.00");
    expect(container.querySelector('button[aria-label="Next school bills page"]')?.hasAttribute("disabled")).toBe(true);
  });

  it("pages payment history independently", () => {
    mocks.payments = Array.from({ length: 11 }, (_, index) => ({ reference: `P${index}`, amount: 10_000 + index * 100, status: "CONFIRMED", status_label: "Confirmed", method_label: "Card", paid_on: "2026-01-01", payer_name: "", source_label: "", has_receipt: false, payment_ref: null }));
    render();
    act(() => (container.querySelector('button[aria-controls="fees-payment-history"]') as HTMLButtonElement).click());
    expect(container.querySelectorAll(".fees-payment")).toHaveLength(10);
    expect(container.querySelector('nav[aria-label="Payment history pages"]')?.textContent).toContain("1–10 of 11");

    act(() => (container.querySelector('button[aria-label="Next payment history page"]') as HTMLButtonElement).click());

    expect(container.querySelectorAll(".fees-payment")).toHaveLength(1);
    expect(container.querySelector('nav[aria-label="Payment history pages"]')?.textContent).toContain("11–11 of 11");
  });

  it("reads a saved copy from before charges were sent", () => {
    render();
    expect(container.textContent).toContain("No bills yet.");
  });

  it("offers an account number to a pupil who owes only a charge and has none", () => {
    mocks.account = { state: "NONE", as_of: "2026-10-19T00:00:00Z" };
    mocks.balance = 150_000;
    mocks.owing = 150_000;
    mocks.charges = [{ note_ref: 4, number: "DN-1", date: "2026-10-19", reason: "Replacement ID Card", total: 150_000, paid: 0, balance: 150_000, status: "UNPAID", status_label: "Owing" }];
    render();
    act(() => (container.querySelector('button[aria-controls="fees-charge-4"]') as HTMLButtonElement).click());
    act(() => (container.querySelector('button[aria-controls="fees-transfer-account"]') as HTMLButtonElement).click());
    expect(container.textContent).toContain("Get my account number");
    expect(container.textContent).toContain("Open Show account number below to get your account number");
    expect(container.textContent).not.toContain("Ask the school office");
  });

  it("sends a pupil to the office only where the school takes no transfers", () => {
    mocks.account = { state: "UNAVAILABLE", message: "Your school cannot take bank transfers here yet." } as never;
    mocks.balance = 150_000;
    mocks.owing = 150_000;
    mocks.charges = [{ note_ref: 4, number: "DN-1", date: "2026-10-19", reason: "Replacement ID Card", total: 150_000, paid: 0, balance: 150_000, status: "UNPAID", status_label: "Owing" }];
    render();
    act(() => (container.querySelector('button[aria-controls="fees-charge-4"]') as HTMLButtonElement).click());
    expect(container.textContent).toContain("Ask the school office how to pay this charge.");
    expect(container.textContent).not.toContain("Get my account number");
  });

  it("does not offer a number when nothing is owed", () => {
    mocks.account = { state: "NONE", as_of: "2026-10-19T00:00:00Z" };
    render();
    expect(container.textContent).not.toContain("Get my account number");
  });
});
