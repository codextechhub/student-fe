import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "src/pages/home.css"), "utf8");

/** The declarations of the rule written for exactly `selector`. */
const block = (selector: string): string =>
  new RegExp(`^${selector.replace(/\./g, "\\.")}\\s*\\{([^}]*)\\}`, "m").exec(css)?.[1] ?? "";

/**
 * Home's payment rows are held inside the page by structure, not by luck: the
 * grid tracks and flex children can shrink below their content, the box model
 * includes padding, and nothing carries a fixed width. A row made of nowrap text
 * in an auto-sized track otherwise widens its card past a 375px phone.
 */
describe("Home payment rows stay inside the page width", () => {
  const parts = [".home-payments-card", ".home-payments", ".home-payment", ".home-payment-main", ".home-payment-side"];

  it("has a rule for every part, and none sets a fixed width", () => {
    for (const selector of parts) {
      expect(block(selector), selector).not.toBe("");
      expect(block(selector), selector).not.toMatch(/(^|[;\s])(width|min-width)\s*:\s*[\d.]+(px|rem|em|vw)/);
    }
  });

  it("lets every track and child shrink", () => {
    expect(block(".home-payments")).toContain("minmax(0, 1fr)");
    expect(block(".home-payment")).toContain("minmax(0, 1fr)");
    expect(block(".home-payment")).toContain("box-sizing: border-box");
    expect(block(".home-payment-main")).toContain("min-width: 0");
    expect(block(".home-payment-side")).toContain("min-width: 0");
  });
});
