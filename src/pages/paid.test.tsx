import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  status: {} as Record<string, unknown>,
  balance: 0,
  owing: 0,
  credit: 0,
  payments: [] as { reference: string; has_receipt: boolean; payment_ref: number }[],
  error: false,
  refetch: vi.fn(),
  dispatch: vi.fn(),
}));
vi.mock("@/redux/hooks", () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock("@/redux/services/base-api", () => ({ baseApi: { util: { invalidateTags: () => ({ type: "invalidate" }) } } }));
vi.mock("@/redux/services/portal-api", () => ({
  usePaymentStatusQuery: () => ({ data: mocks.status, isError: mocks.error, refetch: mocks.refetch }),
  usePaymentsQuery: () => ({ data: mocks.payments }),
  useFeesQuery: () => ({ data: { balance: mocks.balance, owing: mocks.owing, credit: mocks.credit } }),
}));

import { PaidPage } from "./paid";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.dispatch.mockReset();
  mocks.payments = [];
  mocks.balance = 0;
  mocks.owing = 0;
  mocks.credit = 0;
  mocks.error = false;
  mocks.refetch.mockReset();
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = () => act(() => root.render(<MemoryRouter initialEntries={["/fees/paid?reference=R1"]}><PaidPage /></MemoryRouter>));

describe("card payment return", () => {
  it("keeps a pending payment unconfirmed and offers no receipt", () => {
    mocks.status = { status: "PENDING", amount_naira: "₦5,000.00", payee_name: "Lagoon View School" };
    render();
    expect(container.textContent).toContain("Almost there");
    expect(container.textContent).toContain("Waiting for confirmation");
    expect(container.textContent).not.toContain("View receipt");
    expect(container.textContent).not.toContain("New balance");
  });

  it("shows server credit and a receipt only after confirmation", () => {
    mocks.status = { status: "CONFIRMED", amount_naira: "₦5,000.00", payee_name: "Lagoon View School" };
    mocks.balance = -100_000;
    mocks.credit = 100_000;
    mocks.payments = [{ reference: "R1", has_receipt: true, payment_ref: 42 }];
    render();
    expect(container.textContent).toContain("Payment received");
    expect(container.textContent).toContain("₦1,000.00 in credit");
    expect(container.querySelector('a[href="/fees/receipts/42"]')).not.toBeNull();
  });

  it("never says in credit while something is still owed", () => {
    mocks.status = { status: "CONFIRMED", amount_naira: "₦5,000.00", payee_name: "Lagoon View School" };
    mocks.balance = -50_000;
    mocks.owing = 150_000;
    mocks.credit = 200_000;
    render();
    expect(container.textContent).toContain("Your balance is now ₦1,500.00");
    expect(container.textContent).toContain("The school also holds ₦2,000.00 of your credit");
    expect(container.textContent).toContain("New balance");
    expect(container.textContent).toContain("Credit held by the school");
    expect(container.textContent).not.toContain("You have ₦");
    expect(container.textContent).not.toContain("fully paid");
  });

  it("keeps a confirmed payment visible while its receipt is prepared", () => {
    mocks.status = { status: "CONFIRMED", amount_naira: "₦5,000.00", payee_name: "Lagoon View School" };
    render();
    expect(container.textContent).toContain("Payment received");
    expect(container.textContent).toContain("receipt is being prepared");
    expect(container.textContent).not.toContain("View receipt");
    expect(container.textContent).toContain("New balance");
  });

  it("does not offer a receipt or new balance for a failed payment", () => {
    mocks.status = { status: "FAILED", amount_naira: "₦5,000.00", payee_name: "Lagoon View School" };
    render();
    expect(container.textContent).toContain("Payment did not go through");
    expect(container.textContent).toContain("You have not been charged");
    expect(container.textContent).not.toContain("View receipt");
    expect(container.textContent).not.toContain("New balance");
  });

  it("offers another status check after a failed read", () => {
    mocks.status = undefined as unknown as Record<string, unknown>;
    mocks.error = true;
    render();
    const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === "Check again");
    expect(button).toBeDefined();
    act(() => button?.click());
    expect(mocks.refetch).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain("View receipt");
  });
});
