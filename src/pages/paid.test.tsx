import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  status: {} as Record<string, unknown>,
  balance: 0,
  payments: [] as { reference: string; has_receipt: boolean; payment_ref: number }[],
  dispatch: vi.fn(),
}));
vi.mock("@/redux/hooks", () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock("@/redux/services/base-api", () => ({ baseApi: { util: { invalidateTags: () => ({ type: "invalidate" }) } } }));
vi.mock("@/redux/services/portal-api", () => ({
  usePaymentStatusQuery: () => ({ data: mocks.status }),
  usePaymentsQuery: () => ({ data: mocks.payments }),
  useFeesQuery: () => ({ data: { balance: mocks.balance } }),
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
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = () => act(() => root.render(<MemoryRouter initialEntries={["/fees/paid?reference=R1"]}><PaidPage /></MemoryRouter>));

describe("card payment return", () => {
  it("keeps a pending payment unconfirmed and offers no receipt", () => {
    mocks.status = { status: "PENDING", amount_naira: "₦5,000.00", payee_name: "Lagoon View School" };
    render();
    expect(container.textContent).toContain("We're confirming your payment");
    expect(container.textContent).toContain("Waiting for confirmation");
    expect(container.textContent).not.toContain("View receipt");
  });

  it("shows server credit and a receipt only after confirmation", () => {
    mocks.status = { status: "CONFIRMED", amount_naira: "₦5,000.00", payee_name: "Lagoon View School" };
    mocks.balance = -100_000;
    mocks.payments = [{ reference: "R1", has_receipt: true, payment_ref: 42 }];
    render();
    expect(container.textContent).toContain("Payment received");
    expect(container.textContent).toContain("₦1,000.00 in credit");
    expect(container.querySelector('a[href="/fees/receipts/42"]')).not.toBeNull();
  });
});
