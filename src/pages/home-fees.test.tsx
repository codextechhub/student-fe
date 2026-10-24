import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Home } from "@/redux/services/portal-api";

import { FeesCard } from "./home";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Available = Extract<Home["fees"], { available: true }>;
const block = (over: Partial<Available>): Home["fees"] => ({
  available: true, balance: 0, owing: 0, credit: 0, status: "CLEAR", open_invoice: null, open_invoice_count: 0, can_pay: true, ...over,
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (fees: Home["fees"]) => act(() => root.render(<MemoryRouter><FeesCard block={fees} /></MemoryRouter>));
const value = () => container.querySelector(".home-insight-value")?.textContent;

describe("home fee card", () => {
  it("shows what is owed and the credit held when both exist", () => {
    render(block({ status: "OWING", balance: -50_000, owing: 150_000, credit: 200_000, open_invoice_count: 1 }));
    expect(value()).toBe("₦1,500.00");
    expect(container.textContent).toContain("Owing");
    expect(container.querySelector(".home-insight-credit")?.textContent).toBe("₦2,000.00 credit held by the school");
    expect(container.textContent).not.toContain("In credit");
  });

  it("shows credit alone when nothing is owed", () => {
    render(block({ status: "IN_CREDIT", balance: -200_000, credit: 200_000 }));
    expect(value()).toBe("₦2,000.00");
    expect(container.textContent).toContain("In credit");
    expect(container.querySelector(".home-insight-credit")).toBeNull();
  });

  it("shows paid up with no credit line", () => {
    render(block({}));
    expect(value()).toBe("₦0.00");
    expect(container.textContent).toContain("Paid up");
  });

  it("shows no credit line when owing with nothing held", () => {
    render(block({ status: "OWING", balance: 50_000, owing: 50_000 }));
    expect(value()).toBe("₦500.00");
    expect(container.querySelector(".home-insight-credit")).toBeNull();
  });
});
