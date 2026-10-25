/**
 * Watching Amaka's account number while she waits for her father's transfer:
 * five-second looks while the app is in front, none while it is away or after
 * ten idle minutes, an immediate look when she is back or a push says money
 * arrived, and the balance read again once the transfer is booked.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  visibility: "visible" as "visible" | "hidden",
  data: undefined as undefined | { as_of: string; deposits: unknown[] },
  refetch: vi.fn(),
  calls: [] as Array<{ since: string; options: Record<string, unknown> }>,
  dispatch: vi.fn(),
}));

vi.mock("@/redux/hooks", () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock("@/redux/services/base-api", () => ({
  baseApi: { util: { invalidateTags: (tags: string[]) => ({ type: "invalidate", tags }) } },
}));
vi.mock("@/redux/services/portal-api", () => ({
  useDepositsQuery: (since: string, options: Record<string, unknown>) => {
    mocks.calls.push({ since, options });
    return { data: mocks.data, refetch: mocks.refetch };
  },
}));

import { requestDepositCheck } from "@/lib/deposit-signal";

import { IDLE_AFTER_MS, WATCH_EVERY_MS, useDepositWatch } from "./use-deposit-watch";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SINCE = "2026-10-25T09:00:00Z";
const deposit = (status: "PENDING" | "CONFIRMED") => ({
  reference: "TRF-1", amount: 2_500_000, status, status_label: status, received_at: "2026-10-25T09:01:00Z",
  payment_ref: status === "CONFIRMED" ? 77 : null, has_receipt: status === "CONFIRMED",
});

function Probe() {
  const { deposits } = useDepositWatch(SINCE);
  return <p>{deposits.map((d) => d.status).join(",")}</p>;
}

let container: HTMLDivElement;
let root: Root;
const render = () => act(() => root.render(<Probe />));
const polling = () => mocks.calls[mocks.calls.length - 1].options.pollingInterval;
const setVisibility = (state: "visible" | "hidden") => {
  mocks.visibility = state;
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
};

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => mocks.visibility });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.visibility = "visible";
  mocks.data = undefined;
  mocks.calls = [];
  mocks.refetch.mockReset();
  mocks.dispatch.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe("how often the screen looks", () => {
  it("asks for deposits since the screen opened, every five seconds, only while focused", () => {
    render();
    expect(mocks.calls[0].since).toBe(SINCE);
    expect(mocks.calls[0].options).toMatchObject({ pollingInterval: WATCH_EVERY_MS, skipPollingIfUnfocused: true });
  });

  it("stops while the app is away and looks at once when it is back in front", () => {
    render();
    setVisibility("hidden");
    expect(polling()).toBe(0);
    expect(mocks.refetch).not.toHaveBeenCalled();
    setVisibility("visible");
    expect(polling()).toBe(WATCH_EVERY_MS);
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it("stops after ten idle minutes and starts again, looking at once, on the next touch", () => {
    render();
    act(() => { vi.advanceTimersByTime(IDLE_AFTER_MS - 1_000); });
    expect(polling()).toBe(WATCH_EVERY_MS);
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(polling()).toBe(0);
    act(() => { window.dispatchEvent(new Event("pointerdown")); });
    expect(polling()).toBe(WATCH_EVERY_MS);
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it("keeps watching for someone who keeps touching the screen", () => {
    render();
    for (let minute = 0; minute < 15; minute += 1) {
      act(() => { vi.advanceTimersByTime(60_000); });
      act(() => { window.dispatchEvent(new Event("scroll")); });
    }
    expect(polling()).toBe(WATCH_EVERY_MS);
  });

  it("looks at once when a Payment received push arrives in front, even after a long idle", () => {
    render();
    act(() => { vi.advanceTimersByTime(IDLE_AFTER_MS); });
    expect(polling()).toBe(0);
    act(() => requestDepositCheck());
    expect(polling()).toBe(WATCH_EVERY_MS);
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("stops listening for pushes when the screen goes away", () => {
    render();
    act(() => root.unmount());
    root = createRoot(container);
    act(() => requestDepositCheck());
    expect(mocks.refetch).not.toHaveBeenCalled();
  });
});

describe("a transfer arriving", () => {
  it("shows it pending, then received, and reads the fees and home again once it is booked", () => {
    mocks.data = { as_of: SINCE, deposits: [deposit("PENDING")] };
    render();
    expect(container.textContent).toBe("PENDING");
    expect(mocks.dispatch).not.toHaveBeenCalled();

    mocks.data = { as_of: SINCE, deposits: [deposit("CONFIRMED")] };
    render();
    expect(container.textContent).toBe("CONFIRMED");
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch).toHaveBeenCalledWith({ type: "invalidate", tags: ["Fees", "Home", "PaymentNotices"] });

    render();
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
  });
});
