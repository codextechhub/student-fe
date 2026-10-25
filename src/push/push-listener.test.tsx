/**
 * The web app's push listener: a "Payment received" push that arrives while
 * the app is open tells a watching Fees screen to look for the transfer.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listener: null as null | ((event: { data: unknown }) => void) }));

vi.mock("react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/auth/device-session", () => ({ showPupilFromPush: vi.fn() }));
vi.mock("@/redux/hooks", () => ({
  useAppDispatch: () => vi.fn(),
  useAppSelector: (pick: (s: unknown) => unknown) => pick({ session: { status: "signed-out", active: null } }),
}));
vi.mock("./push", () => ({ refreshPush: vi.fn(), routerPath: (p: string) => p }));

import { onDepositCheck } from "@/lib/deposit-signal";

import { PushListener } from "./push-listener";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.listener = null;
  vi.stubGlobal("navigator", {
    ...navigator,
    serviceWorker: {
      addEventListener: (_: string, listener: (event: { data: unknown }) => void) => { mocks.listener = listener; },
      removeEventListener: vi.fn(),
    },
  });
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

describe("a push arriving while the app is open", () => {
  it("nudges the Fees screen for a payment and for nothing else", async () => {
    await act(async () => root.render(<PushListener />));
    const nudged = vi.fn();
    const stop = onDepositCheck(nudged);
    await act(async () => mocks.listener!({ data: { type: "xvs-push-arrived", tag: "billing.payment_received", url: "/student/fees/receipts/9" } }));
    expect(nudged).toHaveBeenCalledTimes(1);
    await act(async () => mocks.listener!({ data: { type: "xvs-push-arrived", tag: "notices.published", url: "/student/notices" } }));
    expect(nudged).toHaveBeenCalledTimes(1);
    stop();
  });
});
