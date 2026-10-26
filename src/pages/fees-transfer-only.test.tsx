/**
 * The Fees screen at a school that takes no card payments (the default), and
 * at one that does, for Amaka, who owes ₦11,687.50 on her First Term bill.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Account =
  | { state: "ISSUED"; bank_name: string; account_number: string; account_name: string; as_of: string }
  | { state: "NONE"; as_of: string }
  | { state: "UNAVAILABLE"; message: string };

const mocks = vi.hoisted(() => ({
  cardPayments: false as boolean | undefined,
  canPay: true,
  offline: false,
  isFetching: false,
  account: null as unknown as Account,
  open: vi.fn(),
  deposits: [] as unknown[],
  depositCalls: [] as string[],
}));

vi.mock("@/redux/hooks", () => ({
  useAppSelector: (pick: (s: unknown) => unknown) => pick({
    connectivity: { offline: mocks.offline },
    session: { active: "amaka", pupils: [{ account: "amaka", fullName: "Amaka Balogun" }] },
  }),
  useAppDispatch: () => vi.fn(),
}));
vi.mock("@/redux/services/portal-api", () => ({
  useFeeBillsQuery: () => {
    const result = {
      balance: 1_168_750, owing: 1_168_750, credit: 0, total_billed: 1_868_750, total_paid: 700_000,
      can_pay: mocks.canPay, card_payments: mocks.cardPayments, min_part_payment: 100_000,
      has_bills: true, years: ["2026"], next_due: null,
      items: [{ kind: "invoice", invoice_ref: 251, number: "IV-1", title: "First Term", invoice_date: null, due_date: null, lines: [], total: 1_868_750, paid: 700_000, balance: 1_168_750, status: "PARTIAL", status_label: "Part-paid" }],
      pagination: { page: 1, page_size: 8, total: 1, total_pages: 1 },
    };
    return { data: result, currentData: result, refetch: vi.fn() };
  },
  usePaymentPageQuery: () => {
    const result = { items: [], years: [], pagination: { page: 1, page_size: 10, total: 0, total_pages: 1 } };
    return { data: result, currentData: result, refetch: vi.fn() };
  },
  useTransferAccountQuery: () => ({ data: mocks.account, isLoading: false, isFetching: mocks.isFetching, isError: false }),
  useMeQuery: () => ({ data: { student: { full_name: "Amaka Balogun" } } }),
  useOpenTransferAccountMutation: () => [mocks.open, { isLoading: false }],
  useDepositsQuery: (since: string) => {
    mocks.depositCalls.push(since);
    return { data: { as_of: since, deposits: mocks.deposits }, refetch: vi.fn() };
  },
  refusal: () => ({ message: "" }),
}));

import { FeesPage } from "./fees";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ISSUED: Account = { state: "ISSUED", bank_name: "Wema Bank", account_number: "0123456789", account_name: "AMAKA BALOGUN", as_of: "2026-10-25T09:00:00Z" };

let container: HTMLDivElement;
let root: Root;
const writeText = vi.fn();
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.cardPayments = false;
  mocks.canPay = true;
  mocks.offline = false;
  mocks.isFetching = false;
  mocks.account = ISSUED;
  mocks.open.mockReset().mockReturnValue({ unwrap: async () => ({}) });
  mocks.deposits = [];
  mocks.depositCalls = [];
  writeText.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

const render = () => act(() => root.render(<MemoryRouter><FeesPage /></MemoryRouter>));
const button = (text: string) => [...container.querySelectorAll("button")].find((b) => b.textContent?.includes(text));

const disclosure = () => container.querySelector('button[aria-controls="fees-transfer-account"]') as HTMLButtonElement;
const open = () => act(() => { disclosure().click(); });

describe("a school that takes no card payments", () => {
  it("puts no account box above the bills: the number waits behind Show account number", () => {
    render();
    expect(container.querySelector(".student-transfer-card")).toBeNull();
    expect(container.textContent).not.toContain("0123456789");
    expect(disclosure().textContent).toContain("Show account number");
    expect(disclosure().getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("#fees-transfer-account")?.hasAttribute("hidden")).toBe(true);
  });

  it("places the disclosure below Payment history, after the bills", () => {
    render();
    const history = container.querySelector('button[aria-controls="fees-payment-history"]')!;
    const bills = container.querySelector(".fees-invoices")!;
    const follows = (a: Node, b: Node) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(bills, history)).toBe(true);
    expect(follows(history, disclosure())).toBe(true);
  });

  it("opens and closes the account card: bank, large number, name and how to pay", () => {
    render();
    open();
    expect(disclosure().getAttribute("aria-expanded")).toBe("true");
    const text = container.querySelector("#fees-transfer-account")?.textContent ?? "";
    expect(text).toContain("Amaka Balogun's account");
    expect(text).toContain("Wema Bank");
    expect(text).toContain("0123456789");
    expect(text).toContain("Bank account name: AMAKA BALOGUN");
    expect(text).toContain("Pay any amount by transfer from your bank app. It shows here as soon as it arrives.");
    expect(container.querySelector(".student-transfer-card.is-lead")).not.toBeNull();

    open();
    expect(disclosure().getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".student-transfer-card")).toBeNull();
    expect(container.textContent).not.toContain("0123456789");
  });

  it("copies the number and says Copied", async () => {
    render();
    open();
    await act(async () => { button("Copy")!.click(); });
    expect(writeText).toHaveBeenCalledWith("0123456789");
    expect(button("Copied")).toBeDefined();
  });

  it("offers no card button, no method choice and no part-payment minimum, and sends Pay bill to the pay step", () => {
    render();
    expect(container.textContent).toContain("First Term");
    expect(container.querySelector("[role=radio]")).toBeNull();
    expect(container.textContent).not.toContain("part payment");
    expect(container.textContent).not.toMatch(/by card/i);
    expect(container.querySelector("a[href='/fees/pay/251']")?.textContent).toBe("Pay bill");
  });

  it("asks for the account when there is none, once, with the button", async () => {
    mocks.account = { state: "NONE", as_of: "2026-10-25T09:00:00Z" };
    render();
    expect(container.textContent).not.toContain("Get my account number");
    open();
    expect(container.textContent).toContain("You don't have an account number for school fees yet");
    expect(container.textContent).not.toContain("0123456789");
    await act(async () => { button("Get my account number")!.click(); });
    expect(mocks.open).toHaveBeenCalledTimes(1);
  });

  it("shows the school's being-set-up sentence when it has no account to give", () => {
    mocks.account = { state: "UNAVAILABLE", message: "Your payment account is being set up. Try again later, or contact the school office." };
    render();
    open();
    expect(container.textContent).toContain("Your payment account is being set up. Try again later, or contact the school office.");
    expect(container.textContent).not.toContain("Pay by card");
  });

  it("shows nothing to pay with where the school does not let pupils pay", () => {
    mocks.canPay = false;
    render();
    expect(disclosure()).toBeNull();
    expect(container.querySelector(".student-transfer-card")).toBeNull();
  });

  it("treats an answer that does not carry the setting as card on, as the app always did", () => {
    mocks.cardPayments = undefined;
    render();
    open();
    expect(container.querySelector(".student-transfer-card.is-lead")).toBeNull();
    expect(container.textContent).toContain("Pay bill");
  });
});

describe("a transfer arriving on the Fees screen", () => {
  it("watches only while the account number is open, from the server's moment of the fresh read, and shows nothing until a transfer comes", () => {
    render();
    expect(mocks.depositCalls).toEqual([]);
    open();
    expect(mocks.depositCalls[0]).toBe("2026-10-25T09:00:00Z");
    expect(container.querySelector(".transfer-activity")).toBeNull();
  });

  it("does not start watching from a read that is still being refreshed", () => {
    mocks.isFetching = true;
    render();
    open();
    expect(mocks.depositCalls).toEqual([]);
  });

  it("shows On its way, then Received with a link to the receipt", () => {
    mocks.deposits = [{ reference: "T1", amount: 2_500_000, status: "PENDING", status_label: "Arriving", received_at: "x", payment_ref: null, has_receipt: false }];
    render();
    open();
    expect(container.querySelector(".transfer-activity")?.textContent).toContain("On its way: ₦25,000.00");
    expect(container.querySelector(".transfer-activity a")).toBeNull();

    mocks.deposits = [{ reference: "T1", amount: 2_500_000, status: "CONFIRMED", status_label: "Received", received_at: "x", payment_ref: 77, has_receipt: true }];
    render();
    expect(container.querySelector(".transfer-activity")?.textContent).toContain("Received: ₦25,000.00");
    expect(container.querySelector(".transfer-activity a")?.getAttribute("href")).toBe("/fees/receipts/77");
    expect(container.querySelector(".transfer-activity a")?.textContent).toBe("View receipt");
  });
});

describe("a school that takes card payments", () => {
  it("is the screen it always was: Pay bill, and the transfer account on demand", () => {
    mocks.cardPayments = true;
    render();
    expect(container.querySelector(".student-transfer-card.is-lead")).toBeNull();
    expect(container.querySelector("a[href='/fees/pay/251']")?.textContent).toBe("Pay bill");
    expect(container.querySelector('button[aria-controls="fees-transfer-account"]')).not.toBeNull();
    expect(mocks.depositCalls).toEqual([]);
  });
});
