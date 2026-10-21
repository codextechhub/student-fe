import { afterEach, describe, expect, it, vi } from "vitest";

import { attemptFor, newClientToken } from "./client-token";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the token on a send", () => {
  it("is a UUID, from the browser's own generator", () => {
    expect(newClientToken()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("is still a version 4 UUID where randomUUID is missing", () => {
    vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(255) });
    expect(newClientToken()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("is kept for a retry of the same words and replaced when the words change", () => {
    let n = 0;
    const make = () => `token-${++n}`;
    const first = attemptFor(null, "See you at 8", make);
    expect(attemptFor(first, "See you at 8", make)).toBe(first);
    const edited = attemptFor(first, "See you at 9", make);
    expect(edited.token).toBe("token-2");
    expect(attemptFor(edited, "See you at 9", make).token).toBe("token-2");
  });
});
