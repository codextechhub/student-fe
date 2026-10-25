import { configureStore } from "@reduxjs/toolkit";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectivityReducer } from "@/redux/features/connectivity-slice";
import { sessionReducer } from "@/redux/features/session-slice";
import { baseApi } from "@/redux/services/base-api";
import "@/redux/services/portal-api";
import "@/redux/services/payment-notices-api";

import { PaymentNotices } from "./payment-notices";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row = (over: Record<string, unknown> = {}) => ({
  id: "6f0d9c52-0000-4000-8000-000000000001",
  event_type_key: "billing.payment_received",
  event_type_label: "Payment received",
  channel: "IN_APP",
  subject: "₦500.00 received from Tunde Bello",
  action_url: "/student/fees/receipts/42",
  is_read: false,
  created_at: "2026-10-25T09:30:00Z",
  ...over,
});

type Calls = { url: string; method: string; body: string }[];

/** A school that answers the feed with `feed`. */
function school(feed: unknown[]) {
  const calls: Calls = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const url = request ? request.url : String(input);
    const method = (request?.method ?? init?.method ?? "GET").toUpperCase();
    const body = request ? await request.clone().text() : String(init?.body ?? "");
    calls.push({ url, method, body });
    const json = (data: unknown) =>
      new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/notify/mark-read/")) return json({ data: { updated_count: 1 } });
    if (url.includes("/notify/")) return json({ data: feed });
    return json({ data: {} });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const store = configureStore({
    reducer: {
      session: sessionReducer,
      connectivity: connectivityReducer,
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (d) => d().concat(baseApi.middleware),
  });
  act(() =>
    root.render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/"]}>
          <PaymentNotices />
        </MemoryRouter>
      </Provider>,
    ),
  );
  return { container, root };
}

const settle = () => act(() => new Promise((r) => setTimeout(r, 30)));

let last: { container: HTMLDivElement; root: Root } | null = null;
beforeEach(() => {
  document.cookie = "csrftoken=abc; path=/";
});
afterEach(() => {
  if (last) {
    act(() => last!.root.unmount());
    last.container.remove();
    last = null;
  }
  vi.unstubAllGlobals();
});

describe("PaymentNotices", () => {
  it("shows an unread payment notice that opens its receipt", async () => {
    const { impl, calls } = school([row()]);
    vi.stubGlobal("fetch", impl);
    last = render();
    await settle();
    const text = last.container.textContent ?? "";
    expect(text).toContain("Payments");
    expect(text).toContain("₦500.00 received from Tunde Bello");
    expect(text).toContain("25 Oct 2026");
    expect(last.container.querySelector("a")?.getAttribute("href")).toBe("/fees/receipts/42");
    const feed = calls.find((c) => c.url.includes("/notify/") && !c.url.includes("mark-read"));
    expect(feed?.url).toContain("event_type_key=billing.payment_received");
    expect(feed?.url).toContain("is_read=false");
  });

  it("opens Fees when the notice names no receipt in this app", async () => {
    for (const action_url of ["", "/finance", "/parent/fees/receipts/42"]) {
      const { impl } = school([row({ action_url })]);
      vi.stubGlobal("fetch", impl);
      last = render();
      await settle();
      expect(last.container.querySelector("a")?.getAttribute("href")).toBe("/fees");
      act(() => last!.root.unmount());
      last.container.remove();
      last = null;
    }
  });

  it("marks the notice read when it is opened and takes it off the screen", async () => {
    const { impl, calls } = school([row()]);
    vi.stubGlobal("fetch", impl);
    last = render();
    await settle();
    act(() => {
      last!.container.querySelector("a")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await settle();
    const marked = calls.find((c) => c.url.includes("/notify/mark-read/"));
    expect(marked?.method).toBe("POST");
    expect(JSON.parse(marked!.body)).toEqual({ ids: [row().id] });
    expect(last.container.textContent).not.toContain("₦500.00 received from Tunde Bello");
  });

  it("draws nothing when there is no unread payment notice", async () => {
    const { impl } = school([]);
    vi.stubGlobal("fetch", impl);
    last = render();
    await settle();
    expect(last.container.textContent).toBe("");
  });

  it("leaves out notices that are not payments, and payments already read", async () => {
    const { impl } = school([
      row({ id: "6f0d9c52-0000-4000-8000-000000000002", event_type_key: "billing.guardian_invoice_issued", subject: "New bill" }),
      row({ id: "6f0d9c52-0000-4000-8000-000000000003", is_read: true }),
    ]);
    vi.stubGlobal("fetch", impl);
    last = render();
    await settle();
    expect(last.container.textContent).toBe("");
  });

  it("draws nothing when the feed cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    last = render();
    await settle();
    expect(last.container.textContent).toBe("");
  });
});
